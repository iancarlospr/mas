import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { enqueueScanJob, getJobState, getQueueDepth } from '../queue/scan-queue.js';
import { getScanById } from '../services/supabase.js';
import { normalizeUrl, getRegistrableDomain } from '../utils/url.js';
import { generateReportPDF, uploadReportPDF, generatePrdPDF, uploadPrdPDF, generatePresentationPDF, uploadPresentationPDF } from '../services/pdf-generator.js';
import type { ModuleTier } from '@marketing-alpha/types';

/**
 * Request body schema for POST /engine/scans.
 * When synthesisOnly is true, url/domain can be empty (read from DB).
 */
const EnqueueScanSchema = z.object({
  scanId: z.string().uuid(),
  url: z.string(),
  tier: z.enum(['full', 'paid']),
  userId: z.string().uuid().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  countryCode: z.string().max(3).nullable().optional(),
  synthesisOnly: z.boolean().optional(),
  domain: z.string().optional(),
});

type EnqueueScanBody = z.infer<typeof EnqueueScanSchema>;

/**
 * Params schema for GET /engine/scans/:id/status.
 */
const ScanIdParams = z.object({
  id: z.string().uuid(),
});

type ScanIdParamsType = z.infer<typeof ScanIdParams>;

/**
 * Register scan-related routes.
 */
export async function scanRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /engine/scans
   *
   * Enqueue a new scan job to the BullMQ queue.
   * Called by the web API server after creating the scan record in Supabase.
   */
  fastify.post(
    '/engine/scans',
    async (
      request: FastifyRequest<{ Body: EnqueueScanBody }>,
      reply: FastifyReply,
    ) => {
      // Validate request body
      const parseResult = EnqueueScanSchema.safeParse(request.body);
      if (!parseResult.success) {
        reply.code(400).send({
          error: 'Invalid request body',
          details: parseResult.error.issues,
        });
        return;
      }

      const { scanId, url, tier, userId, ipAddress, countryCode, synthesisOnly } = parseResult.data;

      // Queue depth protection: reject when queue is overloaded
      const MAX_QUEUE_DEPTH = 50;
      const queueDepth = await getQueueDepth();
      if (queueDepth >= MAX_QUEUE_DEPTH && tier !== 'paid') {
        reply.code(503).send({
          error: 'Service busy',
          message: 'Too many scans in queue. Please try again in a few minutes.',
          queueDepth,
        });
        return;
      }

      let normalizedUrl: string;
      let domain: string | null;

      if (synthesisOnly) {
        // For synthesis-only jobs, read URL from DB
        const scan = await getScanById(scanId);
        if (!scan) {
          reply.code(404).send({ error: 'Scan not found' });
          return;
        }
        normalizedUrl = normalizeUrl(scan['url'] as string);
        domain = getRegistrableDomain(normalizedUrl);
      } else {
        normalizedUrl = normalizeUrl(url);
        domain = getRegistrableDomain(normalizedUrl);
      }

      if (!domain) {
        reply.code(400).send({ error: 'Could not extract domain from URL' });
        return;
      }

      try {
        // Enqueue the scan job
        const jobId = await enqueueScanJob({
          scanId,
          url: normalizedUrl,
          domain,
          tier: tier as ModuleTier,
          userId: userId ?? null,
          ipAddress: ipAddress ?? null,
          countryCode: countryCode ?? null,
          createdAt: new Date().toISOString(),
          synthesisOnly: synthesisOnly ?? false,
        });

        request.log.info(
          { scanId, jobId, url: normalizedUrl, tier },
          'Scan job enqueued',
        );

        reply.code(202).send({
          scanId,
          jobId,
          status: 'queued',
          message: 'Scan job enqueued successfully',
        });
      } catch (error) {
        request.log.error(
          { scanId, error: (error as Error).message },
          'Failed to enqueue scan job',
        );

        reply.code(500).send({
          error: 'Failed to enqueue scan job',
          message: (error as Error).message,
        });
      }
    },
  );

  /**
   * GET /engine/scans/:id/status
   *
   * Read the current state of a scan job from Redis/BullMQ.
   * Used by the web API for polling scan progress.
   */
  fastify.get(
    '/engine/scans/:id/status',
    async (
      request: FastifyRequest<{ Params: ScanIdParamsType }>,
      reply: FastifyReply,
    ) => {
      // Validate params
      const parseResult = ScanIdParams.safeParse(request.params);
      if (!parseResult.success) {
        reply.code(400).send({
          error: 'Invalid scan ID',
          details: parseResult.error.issues,
        });
        return;
      }

      const { id } = parseResult.data;

      try {
        // First check BullMQ for job state
        const jobState = await getJobState(id);

        if (jobState) {
          reply.send({
            scanId: id,
            jobState: jobState.state,
            progress: jobState.progress,
            result: jobState.result,
            failedReason: jobState.failedReason,
          });
          return;
        }

        // If no job found, check Supabase for the scan record
        const scan = await getScanById(id);

        if (scan) {
          reply.send({
            scanId: id,
            jobState: scan['status'] ?? 'unknown',
            progress: scan['status'] === 'complete' ? 100 : 0,
            result: scan['status'] === 'complete'
              ? {
                  scanId: id,
                  status: 'complete',
                  marketingIq: scan['marketing_iq'] ?? null,
                }
              : null,
            failedReason: scan['status'] === 'failed'
              ? (scan['error'] as string) ?? 'Unknown error'
              : null,
          });
          return;
        }

        reply.code(404).send({ error: 'Scan not found' });
      } catch (error) {
        request.log.error(
          { scanId: id, error: (error as Error).message },
          'Failed to get scan status',
        );

        reply.code(500).send({
          error: 'Failed to get scan status',
          message: (error as Error).message,
        });
      }
    },
  );

  /**
   * POST /engine/reports/:id/pdf
   *
   * Generate a PDF for a completed paid scan.
   * Uses Playwright to render the report page and upload to Supabase Storage.
   */
  fastify.post(
    '/engine/reports/:id/pdf',
    async (
      request: FastifyRequest<{ Params: ScanIdParamsType }>,
      reply: FastifyReply,
    ) => {
      const parseResult = ScanIdParams.safeParse(request.params);
      if (!parseResult.success) {
        reply.code(400).send({ error: 'Invalid scan ID' });
        return;
      }

      const { id: scanId } = parseResult.data;
      const reportBaseUrl = process.env['REPORT_BASE_URL']
        ?? process.env['NEXT_PUBLIC_SITE_URL']
        ?? 'http://localhost:3000';

      try {
        request.log.info({ scanId }, 'Generating report PDF');
        const pdf = await generateReportPDF(scanId, reportBaseUrl);
        const signedUrl = await uploadReportPDF(scanId, pdf);
        request.log.info({ scanId }, 'PDF generated and uploaded');
        reply.send({ signedUrl });
      } catch (error) {
        request.log.error(
          { scanId, error: (error as Error).message },
          'Failed to generate PDF',
        );
        reply.code(500).send({
          error: 'PDF generation failed',
          message: (error as Error).message,
        });
      }
    },
  );

  /**
   * POST /engine/reports/:id/prd-pdf
   *
   * Generate the M43 Remediation Plan PDF for a completed paid scan.
   * Converts M43 markdown to styled HTML and renders to legal-size PDF
   * using Patchright. Uploads to Supabase Storage.
   */
  fastify.post(
    '/engine/reports/:id/prd-pdf',
    async (
      request: FastifyRequest<{ Params: ScanIdParamsType }>,
      reply: FastifyReply,
    ) => {
      const parseResult = ScanIdParams.safeParse(request.params);
      if (!parseResult.success) {
        reply.code(400).send({ error: 'Invalid scan ID' });
        return;
      }

      const { id: scanId } = parseResult.data;

      try {
        request.log.info({ scanId }, 'Generating PRD PDF');
        const pdf = await generatePrdPDF(scanId);
        const signedUrl = await uploadPrdPDF(scanId, pdf);
        request.log.info({ scanId }, 'PRD PDF generated and uploaded');
        reply.send({ signedUrl });
      } catch (error) {
        request.log.error(
          { scanId, error: (error as Error).message },
          'Failed to generate PRD PDF',
        );
        reply.code(500).send({
          error: 'PRD PDF generation failed',
          message: (error as Error).message,
        });
      }
    },
  );

  /**
   * POST /engine/reports/:id/presentation-pdf
   *
   * Generate the full slide deck as a landscape PDF.
   * Uses Patchright to navigate to /report/:id/slides?print=true,
   * emulates screen media, and captures each slide as a PDF page.
   */
  fastify.post(
    '/engine/reports/:id/presentation-pdf',
    async (
      request: FastifyRequest<{ Params: ScanIdParamsType }>,
      reply: FastifyReply,
    ) => {
      const parseResult = ScanIdParams.safeParse(request.params);
      if (!parseResult.success) {
        reply.code(400).send({ error: 'Invalid scan ID' });
        return;
      }

      const { id: scanId } = parseResult.data;
      const reportBaseUrl = process.env['REPORT_BASE_URL']
        ?? process.env['NEXT_PUBLIC_SITE_URL']
        ?? 'http://localhost:3000';

      try {
        request.log.info({ scanId }, 'Generating presentation PDF');
        const pdf = await generatePresentationPDF(scanId, reportBaseUrl);
        const signedUrl = await uploadPresentationPDF(scanId, pdf);
        request.log.info({ scanId }, 'Presentation PDF generated and uploaded');
        reply.send({ signedUrl });
      } catch (error) {
        request.log.error(
          { scanId, error: (error as Error).message },
          'Failed to generate presentation PDF',
        );
        reply.code(500).send({
          error: 'Presentation PDF generation failed',
          message: (error as Error).message,
        });
      }
    },
  );
}

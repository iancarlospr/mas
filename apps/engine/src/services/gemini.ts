import { GoogleGenerativeAI, type GenerativeModel, type Part } from '@google/generative-ai';
import { z, type ZodType } from 'zod';
import pino from 'pino';

const logger = pino({ name: 'gemini-service' });

let genAI: GoogleGenerativeAI | null = null;

/**
 * Initialize the Google Generative AI client.
 */
function getClient(): GoogleGenerativeAI {
  if (genAI) return genAI;

  const apiKey = process.env['GOOGLE_AI_API_KEY'];
  if (!apiKey) {
    throw new Error('Missing GOOGLE_AI_API_KEY environment variable');
  }

  genAI = new GoogleGenerativeAI(apiKey);
  logger.info('Google Generative AI client initialized');
  return genAI;
}

/**
 * Model identifiers for different quality tiers.
 */
// NOTE: gemini-3-flash-preview is a preview model. Update to GA model ID
// (e.g., 'gemini-3-flash') when Google promotes it to general availability.
export const MODELS = {
  flash: 'gemini-3-flash-preview',
  // NOTE: gemini-3.1-pro-preview is a preview model. Update when GA releases.
  pro: 'gemini-3.1-pro-preview',
} as const;

export type ModelTier = keyof typeof MODELS;

export interface ImageInput {
  mimeType: string;
  uri: string;
}

interface GenerateOptions {
  model: ModelTier;
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  retries?: number;
  retryDelay?: number;
  images?: ImageInput[];
}

interface GenerateResult<T> {
  data: T;
  model: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
}

const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 2_000;

/**
 * Call Gemini Flash model (fast, cost-effective).
 * Used for M41 individual module synthesis.
 */
export async function callFlash<T>(
  prompt: string,
  schema: ZodType<T>,
  options?: {
    systemInstruction?: string;
    temperature?: number;
    maxTokens?: number;
    images?: ImageInput[];
  },
): Promise<GenerateResult<T>> {
  return generateWithValidation({
    model: 'flash',
    prompt,
    systemInstruction: options?.systemInstruction,
    temperature: options?.temperature ?? 0.3,
    maxTokens: options?.maxTokens ?? 16384,
    images: options?.images,
  }, schema);
}

/**
 * Call Gemini Pro model (high quality, higher latency).
 * Used for M42 final synthesis, M43 PRD generation.
 */
export async function callPro<T>(
  prompt: string,
  schema: ZodType<T>,
  options?: {
    systemInstruction?: string;
    temperature?: number;
    maxTokens?: number;
    images?: ImageInput[];
  },
): Promise<GenerateResult<T>> {
  return generateWithValidation({
    model: 'pro',
    prompt,
    systemInstruction: options?.systemInstruction,
    temperature: options?.temperature ?? 0.4,
    maxTokens: options?.maxTokens ?? 16384,
    images: options?.images,
  }, schema);
}

/**
 * Generate content with retry logic and Zod validation.
 */
async function generateWithValidation<T>(
  options: GenerateOptions,
  schema: ZodType<T>,
): Promise<GenerateResult<T>> {
  const {
    model: modelTier,
    prompt,
    systemInstruction,
    temperature = 0.3,
    maxTokens = 8192,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    images,
  } = options;

  const client = getClient();
  const modelId = MODELS[modelTier];

  const modelConfig: Record<string, unknown> = {
    model: modelId,
  };

  if (systemInstruction) {
    (modelConfig as { systemInstruction?: string }).systemInstruction = systemInstruction;
  }

  const generativeModel: GenerativeModel = client.getGenerativeModel(
    modelConfig as { model: string; systemInstruction?: string },
  );

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = retryDelay * Math.pow(2, attempt - 1);
      logger.info({ attempt, delay, model: modelId }, 'Retrying Gemini call');
      await sleep(delay);
    }

    try {
      // Build multimodal parts: text first, then images (if any)
      const parts: Part[] = [{ text: prompt }];
      if (images?.length) {
        for (const img of images) {
          parts.push({ fileData: { mimeType: img.mimeType, fileUri: img.uri } });
        }
        logger.debug({ imageCount: images.length, model: modelId }, 'Sending multimodal request with images');
      }

      const result = await generativeModel.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
        },
      });

      const response = result.response;
      const text = response.text();

      // Parse JSON response
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch?.[1]) {
          parsed = JSON.parse(jsonMatch[1].trim());
        } else {
          throw new Error('Response is not valid JSON');
        }
      }

      // Validate with Zod
      const validated = schema.parse(parsed);

      // Extract token usage
      const usage = response.usageMetadata;
      const tokensUsed = {
        prompt: usage?.promptTokenCount ?? 0,
        completion: usage?.candidatesTokenCount ?? 0,
        total: usage?.totalTokenCount ?? 0,
      };

      logger.debug(
        { model: modelId, tokensUsed },
        'Gemini call successful',
      );

      return {
        data: validated,
        model: modelId,
        tokensUsed,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check for retryable errors (429 Too Many Requests, 503 Service Unavailable)
      const isRetryable = isRetryableError(lastError);

      if (!isRetryable && attempt < retries) {
        logger.warn(
          { error: lastError.message, model: modelId, attempt },
          'Non-retryable Gemini error',
        );
        // For validation errors, still retry (model might produce better output)
        if (lastError instanceof z.ZodError) {
          continue;
        }
        throw lastError;
      }

      logger.warn(
        { error: lastError.message, model: modelId, attempt },
        'Gemini call failed, will retry',
      );
    }
  }

  throw lastError ?? new Error(`Gemini call failed after ${retries + 1} attempts`);
}

/**
 * Simple text generation without JSON validation.
 * Useful for generating natural language text (PRD, summaries).
 */
export async function generateText(
  modelTier: ModelTier,
  prompt: string,
  options?: {
    systemInstruction?: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<{ text: string; tokensUsed: { prompt: number; completion: number; total: number } }> {
  const client = getClient();
  const modelId = MODELS[modelTier];

  const modelConfig: Record<string, unknown> = { model: modelId };
  if (options?.systemInstruction) {
    (modelConfig as { systemInstruction?: string }).systemInstruction = options.systemInstruction;
  }

  const generativeModel = client.getGenerativeModel(
    modelConfig as { model: string; systemInstruction?: string },
  );

  const result = await generativeModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options?.temperature ?? 0.4,
      maxOutputTokens: options?.maxTokens ?? 16384,
    },
  });

  const response = result.response;
  const usage = response.usageMetadata;

  return {
    text: response.text(),
    tokensUsed: {
      prompt: usage?.promptTokenCount ?? 0,
      completion: usage?.candidatesTokenCount ?? 0,
      total: usage?.totalTokenCount ?? 0,
    },
  };
}

/**
 * Check if an error is retryable (429, 503, network errors).
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('429') ||
    message.includes('too many requests') ||
    message.includes('503') ||
    message.includes('service unavailable') ||
    message.includes('resource exhausted') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('econnrefused') ||
    message.includes('fetch failed')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

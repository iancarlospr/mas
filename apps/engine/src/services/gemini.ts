import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { z, type ZodType } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import pino from 'pino';

const logger = pino({ name: 'gemini-service' });

let ai: GoogleGenAI | null = null;
let apiKeyMissing = false;

/**
 * Initialize the Google GenAI client (unified SDK).
 * Caches missing-key state to fail instantly on subsequent calls.
 */
function getClient(): GoogleGenAI {
  if (ai) return ai;
  if (apiKeyMissing) throw new Error('Missing GOOGLE_AI_API_KEY environment variable');

  const apiKey = process.env['GOOGLE_AI_API_KEY'];
  if (!apiKey) {
    apiKeyMissing = true;
    throw new Error('Missing GOOGLE_AI_API_KEY environment variable');
  }

  ai = new GoogleGenAI({ apiKey });
  logger.info('Google GenAI client initialized');
  return ai;
}

/**
 * Model identifiers for different quality tiers.
 */
export const MODELS = {
  flash: 'gemini-3-flash-preview',
  pro: 'gemini-3.1-pro-preview',
} as const;

/**
 * Fallback models when the primary model is overloaded (503, empty responses).
 * Each primary model gets 2 tries, then falls back to stable for 2 more tries.
 */
const FALLBACK_MODELS: Record<string, string> = {
  'gemini-3-flash-preview': 'gemini-2.5-pro',
  'gemini-3.1-pro-preview': 'gemini-2.5-pro',
};

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

const DEFAULT_RETRIES = 3; // 4 total attempts: 2 primary + 2 fallback
const DEFAULT_RETRY_DELAY = 2_000;
const FALLBACK_AFTER_ATTEMPT = 2; // Switch to fallback model after 2 tries on primary

/**
 * Extract token usage from the new SDK response.
 */
function extractTokenUsage(response: GenerateContentResponse): {
  prompt: number;
  completion: number;
  total: number;
} {
  const usage = response.usageMetadata;
  return {
    prompt: usage?.promptTokenCount ?? 0,
    completion: usage?.candidatesTokenCount ?? 0,
    total: usage?.totalTokenCount ?? 0,
  };
}

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
 * Used for M42 final synthesis, M44/M45.
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
 * Generate content with retry logic, native JSON schema enforcement, and Zod validation.
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
  const primaryModelId = MODELS[modelTier];
  const fallbackModelId = FALLBACK_MODELS[primaryModelId];

  // Convert Zod schema to JSON Schema for native enforcement
  const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' });

  let lastError: Error | null = null;
  let zodRetryUsed = false;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Switch to fallback model after FALLBACK_AFTER_ATTEMPT tries on primary
    const modelId = (attempt >= FALLBACK_AFTER_ATTEMPT && fallbackModelId)
      ? fallbackModelId
      : primaryModelId;

    if (attempt > 0) {
      const delay = retryDelay * Math.pow(2, Math.min(attempt - 1, 2));
      const switched = attempt === FALLBACK_AFTER_ATTEMPT && fallbackModelId;
      logger.info(
        { attempt, delay, model: modelId, ...(switched ? { fallbackFrom: primaryModelId } : {}) },
        switched ? 'Switching to fallback model' : 'Retrying Gemini call',
      );
      await sleep(delay);
    }

    try {
      // Build multimodal parts
      const parts: Array<{ text: string } | { fileData: { mimeType: string; fileUri: string } }> = [
        { text: prompt },
      ];
      if (images?.length) {
        for (const img of images) {
          parts.push({ fileData: { mimeType: img.mimeType, fileUri: img.uri } });
        }
        logger.debug({ imageCount: images.length, model: modelId }, 'Sending multimodal request with images');
      }

      const response = await client.models.generateContent({
        model: modelId,
        contents: [{ role: 'user', parts }],
        config: {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
          responseJsonSchema: jsonSchema,
          systemInstruction,
        },
      });

      const text = response.text ?? '';

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
          throw new Error(`Response is not valid JSON (length: ${text.length})`);
        }
      }

      // Validate with Zod (safety net — native schema should handle most cases)
      const validated = schema.parse(parsed);

      const tokensUsed = extractTokenUsage(response);

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

      // ZodErrors: allow one retry (Gemini is non-deterministic), then throw
      if (lastError instanceof z.ZodError) {
        if (!zodRetryUsed && attempt < retries) {
          zodRetryUsed = true;
          logger.warn(
            {
              model: modelId,
              attempt,
              zodIssues: lastError.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
            },
            'Gemini returned JSON that failed schema validation — retrying once',
          );
          continue;
        }
        logger.error(
          {
            model: modelId,
            attempt,
            zodIssues: lastError.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
          },
          'Gemini schema validation failed after retry — giving up',
        );
        throw lastError;
      }

      // Configuration errors: don't retry (won't self-resolve)
      if (isConfigurationError(lastError)) {
        logger.error(
          { error: lastError.message, model: modelId, attempt },
          'Non-retryable configuration error',
        );
        throw lastError;
      }

      // Everything else: retry (default to optimistic)
      logger.warn(
        {
          error: lastError.message,
          errorName: lastError.name,
          status: (lastError as { status?: number }).status,
          model: modelId,
          attempt,
          willRetry: attempt < retries,
        },
        attempt < retries ? 'Gemini call failed, will retry' : 'Gemini call failed, no retries left',
      );
    }
  }

  throw lastError ?? new Error(`Gemini call failed after ${retries + 1} attempts`);
}

/**
 * Call Gemini Pro for raw text generation with retry logic.
 * No JSON wrapping, no Zod validation — returns plain text.
 * Used for large free-form outputs (e.g., M43 remediation plan markdown).
 */
export async function callProRaw(
  prompt: string,
  options?: {
    systemInstruction?: string;
    temperature?: number;
    maxTokens?: number;
    retries?: number;
    retryDelay?: number;
  },
): Promise<GenerateResult<string>> {
  const retries = options?.retries ?? DEFAULT_RETRIES;
  const retryDelay = options?.retryDelay ?? DEFAULT_RETRY_DELAY;
  const temperature = options?.temperature ?? 0.4;
  const maxTokens = options?.maxTokens ?? 16384;

  const client = getClient();
  const primaryModelId = MODELS.pro;
  const fallbackModelId = FALLBACK_MODELS[primaryModelId];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Switch to fallback model after FALLBACK_AFTER_ATTEMPT tries on primary
    const modelId = (attempt >= FALLBACK_AFTER_ATTEMPT && fallbackModelId)
      ? fallbackModelId
      : primaryModelId;

    if (attempt > 0) {
      const delay = retryDelay * Math.pow(2, Math.min(attempt - 1, 2));
      const switched = attempt === FALLBACK_AFTER_ATTEMPT && fallbackModelId;
      logger.info(
        { attempt, delay, model: modelId, ...(switched ? { fallbackFrom: primaryModelId } : {}) },
        switched ? 'Switching to fallback model' : 'Retrying Gemini raw call',
      );
      await sleep(delay);
    }

    try {
      const response = await client.models.generateContent({
        model: modelId,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature,
          maxOutputTokens: maxTokens,
          systemInstruction: options?.systemInstruction,
        },
      });

      const text = response.text ?? '';
      const tokensUsed = extractTokenUsage(response);

      logger.debug({ model: modelId, tokensUsed, textLength: text.length }, 'Gemini raw call successful');

      return { data: text, model: modelId, tokensUsed };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (isConfigurationError(lastError)) {
        logger.error({ error: lastError.message, model: modelId, attempt }, 'Non-retryable configuration error');
        throw lastError;
      }

      logger.warn(
        {
          error: lastError.message,
          errorName: lastError.name,
          status: (lastError as { status?: number }).status,
          model: modelId,
          attempt,
          willRetry: attempt < retries,
        },
        attempt < retries ? 'Gemini raw call failed, will retry' : 'Gemini raw call failed, no retries left',
      );
    }
  }

  throw lastError ?? new Error(`Gemini raw call failed after ${retries + 1} attempts`);
}

/**
 * Simple text generation without retry logic.
 * Useful for one-off text tasks.
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

  const response = await client.models.generateContent({
    model: modelId,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      temperature: options?.temperature ?? 0.4,
      maxOutputTokens: options?.maxTokens ?? 16384,
      systemInstruction: options?.systemInstruction,
    },
  });

  const tokensUsed = extractTokenUsage(response);

  return {
    text: response.text ?? '',
    tokensUsed,
  };
}

/**
 * Generate an image using Gemini's multimodal image generation.
 * Returns base64-encoded image data or null if generation fails.
 */
export async function generateImage(
  prompt: string,
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const client = getClient();
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    });

    const candidates = response.candidates;
    if (!candidates?.[0]?.content?.parts) return null;

    for (const part of candidates[0].content.parts) {
      if (part.inlineData?.data) {
        logger.info({ mimeType: part.inlineData.mimeType, size: part.inlineData.data.length }, 'Image generated');
        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType ?? 'image/png',
        };
      }
    }
    return null;
  } catch (error) {
    logger.warn({ error: (error as Error).message }, 'Image generation failed');
    return null;
  }
}

/**
 * Check if an error is a configuration error that won't self-resolve.
 */
function isConfigurationError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    (message.includes('missing') && message.includes('environment variable')) ||
    (message.includes('missing') && message.includes('api key')) ||
    message.includes('api key not valid')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

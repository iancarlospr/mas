export { sendEmail } from './send';
export { checkSuppression } from './suppression';
export { checkRateLimit } from './rate-limit';
export { checkDedup } from './dedup';
export { getServiceClient } from './supabase';
export type {
  SendEmailOptions,
  SendEmailResult,
  SendEmailHookPayload,
  ResendWebhookEvent,
} from './types';

import type { ReactElement } from 'react';

export interface SendEmailOptions {
  to: string;
  userId?: string;
  template: string;
  subject: string;
  react: ReactElement;
  referenceId?: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
  critical?: boolean;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  skipped?: 'suppressed' | 'rate_limited' | 'duplicate';
  error?: string;
}

export interface SendEmailHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata: Record<string, unknown>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: 'signup' | 'magiclink' | 'recovery' | 'email_change' | 'invite';
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

export interface ResendWebhookEvent {
  type: string;
  data: {
    id: string;
    from: string;
    to: string[];
    subject?: string;
    created_at?: string;
    delivered_at?: string;
    opened_at?: string;
    clicked_at?: string;
    bounce?: { type: string; message: string };
    click?: { url: string };
    tags?: Record<string, string>;
  };
}

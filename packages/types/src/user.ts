export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  scanId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ChatCredits {
  userId: string;
  remaining: number;
  updatedAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  scanId: string | null;
  stripeSessionId: string | null;
  stripePaymentIntent: string | null;
  product: 'alpha_brief' | 'chat_credits';
  amountCents: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: string;
}

export interface AuditLogEntry {
  id: number;
  userId: string | null;
  action: string;
  resource: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

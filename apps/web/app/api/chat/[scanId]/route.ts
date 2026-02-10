import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

const ChatSchema = z.object({
  message: z.string().min(1).max(2000),
});

function buildSystemPrompt(domain: string, knowledgeBase: unknown): string {
  return `You are the AlphaScan AI Assistant for ${domain}. You have access to
the complete results of a forensic marketing technology audit.

You can answer ANY question about this domain's marketing technology
stack, performance, compliance, tracking, paid media, and more.

RULES:
1. Always cite your sources using [Source: MXX] notation.
   Example: "Your site uses GA4 (G-XXXXXXXX) with enhanced measurement
   enabled [Source: M05]."
2. If asked about something not covered by the scan, say:
   "That wasn't covered in this scan. The audit analyzed [list relevant
   modules]. For that specific question, I'd recommend [actionable
   alternative]."
3. When giving recommendations, reference the PRD workstreams:
   "This is addressed in Workstream WS-02, Task WS-02-T03 [Source: M43]."
4. Be specific. Use actual tool names, configuration values, and
   numbers from the scan data.
5. Keep responses concise unless the user asks for detail.
   Default to 2-3 paragraphs max.
6. You may use the ROI data to quantify impact:
   "Fixing this attribution gap could recover an estimated $X-$Y/month
   in trackable conversions [Source: M44]."

CONTEXT — SCAN KNOWLEDGE BASE:
${JSON.stringify(knowledgeBase)}`;
}

function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GOOGLE_AI_API_KEY');
  }
  return new GoogleGenerativeAI(apiKey);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> },
) {
  const { scanId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = ChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
  }

  // Check credits
  const { data: credits } = await supabase
    .from('chat_credits')
    .select('remaining')
    .eq('user_id', user.id)
    .single();

  if (!credits || credits.remaining <= 0) {
    return NextResponse.json({ error: 'No chat credits remaining' }, { status: 402 });
  }

  // Verify scan exists and user has access
  const { data: scan } = await supabase
    .from('scans')
    .select('id, tier, domain')
    .eq('id', scanId)
    .single();

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  if (scan.tier !== 'paid') {
    return NextResponse.json({ error: 'Alpha Brief required for chat' }, { status: 403 });
  }

  // Save user message
  await supabase.from('chat_messages').insert({
    scan_id: scanId,
    user_id: user.id,
    role: 'user',
    content: parsed.data.message,
  });

  // Get knowledge base from M46
  const { data: kb } = await supabase
    .from('module_results')
    .select('data')
    .eq('scan_id', scanId)
    .eq('module_id', 'M46')
    .single();

  const knowledgeBase = kb?.data?.knowledgeBase ?? kb?.data ?? {};

  // Get chat history
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('scan_id', scanId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(20);

  let assistantResponse: string;

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: buildSystemPrompt(scan.domain, knowledgeBase),
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    });

    // Build conversation history for context
    const chatHistory = (history ?? [])
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({
        role: m.role === 'assistant' ? 'model' as const : 'user' as const,
        parts: [{ text: m.content }],
      }));

    // Remove the last user message (it's the current one, we'll send it separately)
    if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1]!.role === 'user') {
      chatHistory.pop();
    }

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(parsed.data.message);
    assistantResponse = result.response.text();
  } catch (error) {
    // Fallback if Gemini is unavailable
    assistantResponse = `I'm the AlphaScan AI Assistant for ${scan.domain}. I'm currently unable to process your question due to a temporary issue. Please try again in a moment. Your question: "${parsed.data.message}"`;
  }

  // Save assistant response
  await supabase.from('chat_messages').insert({
    scan_id: scanId,
    user_id: user.id,
    role: 'assistant',
    content: assistantResponse,
  });

  // Decrement credits
  await supabase
    .from('chat_credits')
    .update({
      remaining: credits.remaining - 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  return NextResponse.json({
    message: assistantResponse,
    creditsRemaining: credits.remaining - 1,
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> },
) {
  const { scanId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('scan_id', scanId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  const { data: credits } = await supabase
    .from('chat_credits')
    .select('remaining')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({
    messages: messages ?? [],
    creditsRemaining: credits?.remaining ?? 0,
  });
}

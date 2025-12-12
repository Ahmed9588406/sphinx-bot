/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createSupabaseClient, handleChat, simpleChat } from '../../../lib/agent';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Get user from token
async function getUserFromToken(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) return null;
  
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.API_KEY;
  if (!url || !anonKey) return null;
  
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Save message to database
async function saveMessage(
  supabase: any,
  conversationId: string,
  sender: 'user' | 'assistant',
  content: string,
  senderId?: string
) {
  try {
    await (supabase as any).from('messages').insert({
      conversation_id: conversationId,
      sender,
      sender_id: senderId || null,
      content,
      metadata: {}
    });
    
    // Update conversation's last_message_at
    await (supabase as any).from('conversations').update({
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', conversationId);
  } catch (err) {
    console.error('Failed to save message:', err);
  }
}


// Get or create conversation for user
async function getOrCreateConversation(supabase: any, odUserId: string) {
  // Try to get existing open conversation
  const { data: existing } = await (supabase as any)
    .from('conversations')
    .select('id')
    .eq('user_id', odUserId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (existing) return existing.id;
  
  // Create new conversation
  const { data: newConv, error } = await (supabase as any)
    .from('conversations')
    .insert({
      user_id: odUserId,
      title: 'محادثة دعم',
      status: 'open',
      metadata: {}
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Failed to create conversation:', error);
    return null;
  }
  
  return newConv?.id || null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, customerContext, conversationHistory, userName, page, offset } = body;
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid message' }, { status: 400 });
    }

    // Check if ChatAnywhere API key is configured
    if (!process.env.CHAT_ANYWHERE_API_KEY) {
      return NextResponse.json({ 
        error: 'Chat service not configured. Please set CHAT_ANYWHERE_API_KEY in environment.' 
      }, { status: 500 });
    }

    // Get authenticated user if token provided
    const user = await getUserFromToken(req);
    
    // Create Supabase client (may be null if not configured)
    const supabase = createSupabaseClient();
    
    // Get or create conversation for authenticated user
    let conversationId: string | null = null;
    if (user && supabase) {
      conversationId = await getOrCreateConversation(supabase, user.id);
      
      // Save user message
      if (conversationId) {
        await saveMessage(supabase, conversationId, 'user', message, user.id);
      }
    }
    
    // Use handleChat with RAG if Supabase is configured, otherwise simpleChat
    let reply: string;
    let docs: unknown[] = [];
    let result: any = null;
    
    if (supabase) {
      result = await handleChat(supabase, message, { 
        customerContext: userName ? `اسم العميل: ${userName}` : customerContext, 
        conversationHistory,
        userId: user?.id,
        userName: user?.email || (user?.user_metadata?.full_name ?? undefined),
        page: page ?? undefined,
        offset: offset ?? undefined,
        conversationId: conversationId ?? undefined,
      });
      reply = result.reply;
      docs = result.docs;
    } else {
      // Fallback: simple chat without RAG
      reply = await simpleChat(message);
    }
    
    // Save assistant reply for authenticated user
    if (user && supabase && conversationId) {
      await saveMessage(supabase, conversationId, 'assistant', reply);
    }
    
    // Build response payload
    const responsePayload: any = {
      reply,
      docs,
      mode: supabase ? 'rag' : 'simple',
      conversationId
    };

    // Include additional fields returned by handleChat if available
    if (result) {
      if (result.paging) responsePayload.paging = result.paging;
      if (result.order) responsePayload.order = result.order;
      if (result.draftOrder) responsePayload.draftOrder = result.draftOrder;
      if (result.receipt) responsePayload.receipt = result.receipt;
      if (result.confirmedOrder) responsePayload.confirmedOrder = result.confirmedOrder;
    }

    return NextResponse.json(responsePayload);
    
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API /api/chat error:', errorMessage);
    
    // Return user-friendly error messages
    if (errorMessage.includes('CHAT_ANYWHERE_API_KEY')) {
      return NextResponse.json({ error: 'Chat service not configured' }, { status: 500 });
    }
    if (errorMessage.includes('ChatAnywhere error')) {
      return NextResponse.json({ error: 'Chat service temporarily unavailable' }, { status: 503 });
    }
    
    return NextResponse.json({ error: 'حصل خطأ، جرب تاني' }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  const hasApiKey = !!process.env.CHAT_ANYWHERE_API_KEY;
  const hasSupabase = !!process.env.SUPABASE_URL && !!(process.env.API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  return NextResponse.json({
    status: hasApiKey ? 'ok' : 'missing_api_key',
    features: {
      chat: hasApiKey,
      rag: hasSupabase
    }
  });
}


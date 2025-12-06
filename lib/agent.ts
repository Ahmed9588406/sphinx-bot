/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Basic types used across helper functions
type DocumentRecord = {
  id?: string;
  content: string;
  metadata?: Record<string, any>;
};

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/**
 * createSupabaseClient
 * - Creates a Supabase client using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from env.
 * - Use the Service Role key only on trusted server-side code (ingestion, upserts).
 * - Returns null if env vars are missing (allows graceful degradation).
 */
export function createSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.API_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.warn('Supabase not configured — running without vector DB');
    return null;
  }

  return createClient(url, key);
}

/**
 * embedText
 * - Generic embedding wrapper supporting OpenAI and ChatAnywhere providers.
 * - Returns a numeric vector for the input text.
 */
export async function embedText(text: string): Promise<number[]> {
  const provider = (process.env.EMBEDDING_PROVIDER || 'openai').toLowerCase();

  // 1) OpenAI-compatible embeddings
  if (provider === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('Missing OPENAI_API_KEY for embedding provider');

    const body = {
      input: text,
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
    };

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OpenAI embedding error: ${res.status} ${t}`);
    }
    const j = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return j.data[0].embedding;
  }

  // 2) ChatAnywhere (uses an OpenAI-compatible embedding API path)
  if (provider === 'chatanywhere' || provider === 'chat-anywhere') {
    const key = process.env.CHAT_ANYWHERE_API_KEY;
    if (!key) throw new Error('Missing CHAT_ANYWHERE_API_KEY for ChatAnywhere embedding provider');

    const baseUrl = process.env.CHAT_ANYWHERE_API_URL || 'https://api.chatanywhere.tech/v1/chat/completions';
    const embedUrl = process.env.CHAT_ANYWHERE_EMBEDDING_URL || baseUrl.replace('/chat/completions', '/embeddings');

    const body = {
      input: text,
      model: process.env.CHAT_ANYWHERE_EMBEDDING_MODEL || 'text-embedding-3-small'
    };

    const res = await fetch(embedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`ChatAnywhere embedding error: ${res.status} ${t}`);
    }
    const j = (await res.json()) as { data?: Array<{ embedding: number[] }>; embedding?: number[] };

    if (j.data && Array.isArray(j.data) && j.data[0]?.embedding) return j.data[0].embedding;
    if (j.embedding) return j.embedding;
    throw new Error('Unexpected ChatAnywhere embedding response shape: ' + JSON.stringify(j).slice(0, 500));
  }

  throw new Error(`Unsupported EMBEDDING_PROVIDER: ${provider}`);
}

/**
 * upsertDocuments
 * - Generates embeddings and inserts documents into Supabase `documents` table.
 */
export async function upsertDocuments(supabase: SupabaseClient, docs: DocumentRecord[]) {
  if (!docs || docs.length === 0) return [];

  const dim = Number(process.env.EMBEDDING_DIM || 1536);
  const rows: any[] = [];

  for (const d of docs) {
    const emb = await embedText(d.content);
    if (emb.length !== dim) {
      console.warn(`embedding dim ${emb.length} does not match EMBEDDING_DIM ${dim}`);
    }
    rows.push({ content: d.content, metadata: d.metadata || {}, embedding: emb });
  }

  const { data, error } = await supabase.from('documents').insert(rows).select('*');
  if (error) throw error;
  return data;
}

/**
 * querySimilar
 * - Embeds text and calls Supabase RPC `match_documents` for nearest docs.
 * - Returns empty array if RPC fails (graceful degradation).
 * - Filters out documents with zero/null embeddings (score threshold).
 */
export async function querySimilar(supabase: SupabaseClient | null, text: string, k = 5) {
  if (!supabase) return [];
  
  try {
    const emb = await embedText(text);
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: emb,
      match_count: k
    }) as any;

    if (error) {
      console.error('Supabase RPC error:', error.message);
      return [];
    }
    
    // Filter out results with very low scores (likely zero-vector placeholders)
    const filtered = (data || []).filter((d: any) => d.score > 0.1);
    return filtered as Array<{ id: string; content: string; metadata: any; score: number }>;
  } catch (err: any) {
    console.error('querySimilar error:', err.message);
    return [];
  }
}

/**
 * getAllProducts
 * - Fetches all products directly from the products table.
 * - Use this for "list all products" type queries.
 */
export async function getAllProducts(supabase: SupabaseClient | null, limit = 20) {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, title, description, price, currency, tags')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('getAllProducts error:', error.message);
      return [];
    }
    return data || [];
  } catch (err: any) {
    console.error('getAllProducts error:', err.message);
    return [];
  }
}

/**
 * callChatAnywhere
 * - Calls the ChatAnywhere chat completions endpoint.
 * - Returns the assistant's text response.
 */
export async function callChatAnywhere(messages: ChatMessage[], model?: string): Promise<string> {
  const apiKey = process.env.CHAT_ANYWHERE_API_KEY;
  const url = process.env.CHAT_ANYWHERE_API_URL || 'https://api.chatanywhere.tech/v1/chat/completions';
  
  if (!apiKey) throw new Error('Missing CHAT_ANYWHERE_API_KEY');

  const body = {
    model: model || process.env.CHAT_MODEL || 'gpt-4o-mini',
    messages,
    temperature: 0.7,
    max_tokens: 1024
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`ChatAnywhere error ${res.status}: ${t}`);
  }

  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string }; text?: string }> };
  const content = j.choices?.[0]?.message?.content || j.choices?.[0]?.text;
  
  if (!content) {
    throw new Error('No content in ChatAnywhere response');
  }
  
  return content;
}

/**
 * handleChat
 * - High-level RAG handler for customer support.
 * - Works with or without Supabase (graceful degradation).
 * - Detects product listing queries and fetches all products.
 */
export async function handleChat(
  supabase: SupabaseClient | null, 
  userMessage: string, 
  options?: { customerContext?: string; conversationHistory?: ChatMessage[] }
): Promise<{ reply: string; docs: any[] }> {
  
  // Detect if user is asking to list all products
  const productListingKeywords = [
    'المنتجات', 'منتجات', 'products', 'عندك', 'عندكم', 'متاح', 'متوفر',
    'ايه عندك', 'إيه عندك', 'شو عندك', 'بتبيعوا', 'بتبيع', 'الكاتالوج',
    'كل المنتجات', 'list', 'show me', 'what do you have', 'available'
  ];
  
  const isProductListingQuery = productListingKeywords.some(kw => 
    userMessage.toLowerCase().includes(kw.toLowerCase())
  );

  // 1. Get context based on query type
  let docs: any[] = [];
  let products: any[] = [];
  
  try {
    if (isProductListingQuery && supabase) {
      // Fetch all products directly for listing queries
      products = await getAllProducts(supabase, 20);
    }
    // Also try vector search for additional context
    docs = await querySimilar(supabase, userMessage, 5);
  } catch (err) {
    console.warn('Could not query docs/products, continuing without RAG');
  }

  // 2. Build system prompt (Egyptian Arabic tone for Sphinx Fit - ONLY use provided data)
  const systemPrompt = `أنت مساعد خدمة عملاء لبراند Sphinx Fit.
  
⚠️ قواعد مهمة جداً:
- رد فقط بناءً على المعلومات المتاحة في "المنتجات المتاحة" و "معلومات إضافية" اللي تحت.
- لو المنتج مش موجود في القائمة، قول "المنتج ده مش متوفر عندنا حالياً".
- متخترعش منتجات أو أسعار أو معلومات من عندك.
- لو مفيش معلومات كافية، قول "مش متأكد من المعلومة دي، هتواصل مع الفريق".

طريقة الرد:
- رد بالعربي المصري بطريقة ودية ومختصرة.
- لو سألوا عن حالة طلب، اطلب رقم الطلب.
- لما تعرض منتجات، اعرضهم بشكل منظم مع السعر.

معلومات عن البراند:
- Sphinx Fit بيبيع ملابس رياضية
- الشحن متاح لكل محافظات مصر (2-5 أيام عمل)
- الإرجاع والاستبدال خلال 14 يوم
- الدفع: كاش عند الاستلام أو فودافون كاش`;

  // 3. Format context
  let contextText = '';
  
  // Add products list if available
  if (products.length > 0) {
    contextText += '\n\n📦 المنتجات المتاحة حالياً:\n';
    products.forEach((p, i) => {
      contextText += `${i + 1}. ${p.title}`;
      if (p.price) contextText += ` - ${p.price} ${p.currency || 'EGP'}`;
      if (p.description) contextText += `\n   ${p.description}`;
      contextText += '\n';
    });
  }
  
  // Add vector search results if available (and different from products)
  if (docs.length > 0) {
    const productDocs = docs.filter(d => d.metadata?.product_id || d.source === 'product');
    const otherDocs = docs.filter(d => !d.metadata?.product_id && d.source !== 'product');
    
    if (otherDocs.length > 0) {
      contextText += '\n\nمعلومات إضافية:\n' + 
        otherDocs.map((d, i) => `- ${d.content}`).join('\n');
    }
  }

  // 4. Build messages array
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt + contextText }
  ];

  // Add conversation history if provided
  if (options?.conversationHistory && options.conversationHistory.length > 0) {
    // Keep last 10 messages for context
    const recentHistory = options.conversationHistory.slice(-10);
    messages.push(...recentHistory);
  }

  // Add customer context if provided
  const userContent = options?.customerContext 
    ? `[معلومات العميل: ${options.customerContext}]\n\n${userMessage}`
    : userMessage;
  
  messages.push({ role: 'user', content: userContent });

  // 5. Call ChatAnywhere
  const reply = await callChatAnywhere(messages);
  
  return { reply, docs: products.length > 0 ? products : docs };
}

/**
 * recommendProducts
 * - Returns top k product-like documents for recommendations.
 */
export async function recommendProducts(supabase: SupabaseClient | null, query: string, k = 4) {
  const docs = await querySimilar(supabase, query, k);
  return docs.map(d => ({
    id: d.id,
    score: d.score,
    metadata: d.metadata,
    snippet: d.content.slice(0, 300)
  }));
}

/**
 * simpleChat
 * - Direct chat without RAG, for testing or when Supabase is not configured.
 * - Will tell user that no product info is available.
 */
export async function simpleChat(userMessage: string): Promise<string> {
  const systemPrompt = `أنت مساعد خدمة عملاء لبراند Sphinx Fit.

⚠️ ملاحظة: مفيش بيانات منتجات متاحة دلوقتي.
- لو سألوا عن منتجات، قول "معلش، مش قادر أوصل لبيانات المنتجات دلوقتي. تواصل معانا على الإنستجرام."
- رد بالعربي المصري بطريقة ودية.
- لو سألوا عن طلب، اطلب رقم الطلب.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  return callChatAnywhere(messages);
}

export default {
  createSupabaseClient,
  embedText,
  upsertDocuments,
  querySimilar,
  getAllProducts,
  callChatAnywhere,
  handleChat,
  recommendProducts,
  simpleChat
};

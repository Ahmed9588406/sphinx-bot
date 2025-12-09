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
    const resolvedLimit = Number(process.env.PRODUCT_LIST_LIMIT || limit || 100);
    const { data, error } = await supabase
      .from('products')
      .select('id, title, description, price, currency, tags, product_images(*)')
      .order('created_at', { ascending: false })
      .limit(resolvedLimit);
    
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
 * getAllProductsAll
 * - Fetches ALL products by paging through results in batches.
 * - Use with caution for very large catalogs. Batch size is configurable via env PRODUCT_PAGE_SIZE.
 */
export async function getAllProductsAll(supabase: SupabaseClient | null) {
  if (!supabase) return [];

  try {
    const pageSize = Number(process.env.PRODUCT_PAGE_SIZE || 200);
    let offset = 0;
    const all: any[] = [];

    while (true) {
      const { data, error } = await supabase
        .from('products')
        .select('id, title, description, price, currency, tags, product_images(*)')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      all.push(...data);
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    return all;
  } catch (err: any) {
    console.error('getAllProductsAll error:', err.message || err);
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
  options?: { customerContext?: string; conversationHistory?: ChatMessage[]; userId?: string; userName?: string; page?: number; offset?: number }
): Promise<any> {
  
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
  const products: any[] = [];
  
  try {
    // For product listing queries, support paging so replies are not enormous.
    if (isProductListingQuery && supabase) {
      const pageSize = Number(process.env.PRODUCT_LIST_REPLY_PAGE_SIZE || 20);
      const offset = typeof options?.offset === 'number' ? options!.offset : (typeof options?.page === 'number' ? (Math.max(1, options!.page) - 1) * pageSize : 0);

      // Get total count (efficient small query)
      const countRes = await supabase.from('products').select('id', { count: 'exact', head: true });
      const total = typeof countRes.count === 'number' ? countRes.count : null;

      // Fetch the requested page
      const { data: pageData, error: pageErr } = await supabase
        .from('products')
        .select('id, title, description, price, currency, tags, product_images(*)')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (pageErr) throw pageErr;

      // Also fetch small set of vector docs for additional context
      try { docs = await querySimilar(supabase, userMessage, 5); } catch (e) { docs = []; }

      // Build a plain-text listing for this page with full descriptions
      const lines: string[] = [];
      lines.push(`قائمة المنتجات (${offset + 1}${pageData && pageData.length ? ` - ${offset + pageData.length}` : ''}${total ? ` من ${total}` : ''}):`);
      lines.push('');
      (pageData || []).forEach((p: any, i: number) => {
        const idx = offset + i + 1;
        const title = p.title || 'No title';
        const price = p.price ? `${p.price} ${p.currency || 'EGP'}` : '';
        const desc = p.description ? ` - ${String(p.description).replace(/\s+/g, ' ')}` : '';
        lines.push(`${idx}. ${title}${price ? ` — ${price}` : ''}${desc}`);
      });

      // Provide instruction for fetching next page
      const nextOffset = total && offset + pageSize < total ? offset + pageSize : null;
      if (nextOffset !== null) {
        lines.push('');
        lines.push(`للمزيد اكتب "عرض المزيد" أو أرسل الطلب مع { "offset": ${nextOffset} }`);
      }

      const replyText = lines.join('\n');
      return { reply: replyText, docs: pageData || [], paging: { offset, pageSize, total, nextOffset } } as any;
    }

    // Non-listing queries: also try vector search for additional context
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
  
  // 6. Try to detect an order intent and extract order details using the LLM
  try {
    const orderDetails = await extractOrderDetails(userMessage);
    // If we found items and have a supabase client and userId, create a DRAFT order and ask for confirmation
    if (orderDetails && Array.isArray(orderDetails.items) && orderDetails.items.length > 0 && supabase && options?.userId) {
      // Build order items with product ids/prices when possible
      const itemsWithPrices = await Promise.all(orderDetails.items.map(async (it: any) => {
        // try to find product by title in fetched products
        const found = (products || []).find(p => p.title && String(p.title).toLowerCase().includes(String(it.product_title || it.title || '').toLowerCase()));
        return {
          product_title: it.product_title || it.title,
          product_id: found?.id || null,
          quantity: Number(it.quantity || 1),
          unit_price: found?.price || Number(it.unit_price || 0)
        };
      }));

      const total = itemsWithPrices.reduce((s: number, it: any) => s + (Number(it.unit_price || 0) * Number(it.quantity || 1)), 0);

      // generate human-friendly order number
      const orderNumber = `SFX-${Date.now().toString(36)}-${Math.floor(Math.random() * 9000) + 1000}`;

      const draftRecord: any = {
        user_id: options.userId,
        status: 'draft',
        total: total,
        currency: 'EGP',
        shipping_address: orderDetails.shipping || null,
        metadata: {
          created_via: 'chat-assistant',
          customer_name: options.userName || null,
          order_number: orderNumber
        }
      };

      const { data: draftOrder, error: draftError } = await supabase.from('orders').insert(draftRecord).select().single();
      if (!draftError && draftOrder) {
        // Insert order_items rows for the draft
        const orderItems = itemsWithPrices.map((it: any) => ({
          order_id: draftOrder.id,
          product_id: it.product_id,
          quantity: it.quantity,
          price: it.unit_price || 0,
          metadata: {}
        }));
        try {
          await supabase.from('order_items').insert(orderItems);
        } catch (e) {
          // ignore if table doesn't exist
        }

        // Prepare a draft receipt text
        const receiptLines = [] as string[];
        receiptLines.push(`Draft Order ID: ${draftOrder.id}`);
        receiptLines.push('Items:');
        itemsWithPrices.forEach((it: any, idx: number) => {
          receiptLines.push(`${idx + 1}. ${it.product_title} x${it.quantity} — ${it.unit_price || 0} EGP`);
        });
        receiptLines.push(`Total: ${total} EGP`);
        if (orderDetails.shipping) {
          receiptLines.push('Shipping:');
          if (orderDetails.shipping.name) receiptLines.push(`Name: ${orderDetails.shipping.name}`);
          if (orderDetails.shipping.phone) receiptLines.push(`Phone: ${orderDetails.shipping.phone}`);
          if (orderDetails.shipping.address) receiptLines.push(`Address: ${orderDetails.shipping.address}`);
        }

        const receiptText = receiptLines.join('\n');

        // Ask the user to confirm the draft order
        const confirmPrompt = `انا جهزت طلب مؤقت برقم ${draftOrder.id} بمجموع ${total} EGP. عايز تأكد الطلب؟ (اكتب "نعم" للتأكيد أو "لا" للإلغاء)`;
        const finalReply = reply + '\n\n' + confirmPrompt;

        return { reply: finalReply, docs: products.length > 0 ? products : docs, draftOrder, receipt: receiptText } as any;
      }
    }
  } catch (e) {
    console.warn('Order extraction/creation failed:', e instanceof Error ? e.message : String(e));
  }

  return { reply, docs: products.length > 0 ? products : docs };
}

/**
 * extractOrderDetails
 * Asks the LLM to extract structured order information from a free-text user message.
 * Returns: { items: [{ product_title, quantity, unit_price? }], shipping?: { name, address, phone } }
 */
export async function extractOrderDetails(userMessage: string) {
  // Build a small prompt that asks for JSON only
  const prompt = `Extract order details from the user's message as JSON.
Return exactly JSON with this shape: { "items": [ { "product_title": string, "quantity": number, "unit_price": number | null } ], "shipping": { "name": string | null, "phone": string | null, "address": string | null } }

If you cannot extract any items, return: { "items": [] }

User message:\n${userMessage}\n\nJSON:`;

  const raw = await callChatAnywhere([{ role: 'system', content: 'You are a JSON extraction assistant. Respond ONLY with valid JSON.' }, { role: 'user', content: prompt }], process.env.CHAT_MODEL || undefined);
  // Try to parse JSON from response
  try {
    const j = JSON.parse(raw.trim());
    return j;
  } catch (err) {
    // Try to extract JSON substring
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch (e) { return { items: [] }; }
    }
    return { items: [] };
  }
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

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { translateToEnglish, buildSearchQueries, generateBilingualProductText } from './productDictionary';

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
 * upsertProductDocuments
 * - Creates bilingual (Arabic + English) document embeddings for products
 * - Uses generateBilingualProductText to include Arabic translations
 * - This improves semantic search for Arabic queries
 */
export async function upsertProductDocuments(
  supabase: SupabaseClient,
  products: Array<{
    id: string;
    title: string;
    description?: string;
    price?: number;
    currency?: string;
    tags?: string[];
    metadata?: { color?: string; gender?: string; material?: string };
  }>
) {
  if (!products || products.length === 0) return [];

  const dim = Number(process.env.EMBEDDING_DIM || 1536);
  const rows: any[] = [];

  for (const product of products) {
    // Generate bilingual content for better Arabic matching
    const bilingualContent = generateBilingualProductText(product);

    // Also include price info for context
    const fullContent = product.price
      ? `${bilingualContent} السعر: ${product.price} ${product.currency || 'EGP'}`
      : bilingualContent;

    console.log(`Generating bilingual embedding for: ${product.title}`);

    const emb = await embedText(fullContent);
    if (emb.length !== dim) {
      console.warn(`embedding dim ${emb.length} does not match EMBEDDING_DIM ${dim}`);
    }

    rows.push({
      content: fullContent,
      metadata: {
        product_id: product.id,
        title: product.title,
        price: product.price,
        currency: product.currency || 'EGP',
        tags: product.tags,
        ...product.metadata
      },
      embedding: emb
    });
  }

  // Upsert documents (delete existing product docs first to avoid duplicates)
  const productIds = products.map(p => p.id);

  // Delete existing documents for these products
  await supabase
    .from('documents')
    .delete()
    .filter('metadata->>product_id', 'in', `(${productIds.map(id => `"${id}"`).join(',')})`);

  // Insert new documents
  const { data, error } = await supabase.from('documents').insert(rows).select('*');
  if (error) throw error;

  console.log(`Upserted ${rows.length} bilingual product documents`);
  return data;
}

/**
 * regenerateAllProductEmbeddings
 * - Fetches all products and regenerates their embeddings with bilingual content
 * - Call this after updating the product dictionary
 */
export async function regenerateAllProductEmbeddings(supabase: SupabaseClient) {
  console.log('Fetching all products for embedding regeneration...');

  const { data: products, error } = await supabase
    .from('products')
    .select('id, title, description, price, currency, tags, metadata');

  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  if (!products || products.length === 0) {
    console.log('No products found');
    return [];
  }

  console.log(`Found ${products.length} products, regenerating embeddings...`);

  // Process in batches to avoid rate limits
  const batchSize = 10;
  const results: any[] = [];

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)}`);

    const batchResults = await upsertProductDocuments(supabase, batch);
    results.push(...(batchResults || []));

    // Small delay between batches to avoid rate limits
    if (i + batchSize < products.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`Regenerated embeddings for ${results.length} products`);
  return results;
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
 * - Handles order confirmation and cancellation flows.
 * - Integrates product matching for order creation.
 */
export async function handleChat(
  supabase: SupabaseClient | null,
  userMessage: string,
  options?: { customerContext?: string; conversationHistory?: ChatMessage[]; userId?: string; userName?: string; page?: number; offset?: number, conversationId?: string; }
): Promise<any> {

  // Detect if user is asking to list ALL products (not a specific product)
  // These are phrases that specifically ask for a list of all products
  const productListingPhrases = [
    'كل المنتجات', 'جميع المنتجات', 'المنتجات كلها', 'ايه المنتجات', 'إيه المنتجات',
    'ايه عندك', 'إيه عندك', 'شو عندك', 'ايه عندكم', 'إيه عندكم',
    'بتبيعوا ايه', 'بتبيعوا إيه', 'بتبيع ايه', 'بتبيع إيه',
    'الكاتالوج', 'قائمة المنتجات', 'اعرض المنتجات', 'عرض المنتجات',
    'list all', 'show all', 'all products', 'what do you have', 'what do you sell'
  ];

  // Check if the message is asking for ALL products (not a specific one)
  const normalizedMsg = userMessage.toLowerCase().trim();
  const isProductListingQuery = productListingPhrases.some(phrase =>
    normalizedMsg.includes(phrase.toLowerCase())
  ) || (
      // Also match short generic queries like "المنتجات" alone
      ['المنتجات', 'منتجات', 'products'].includes(normalizedMsg)
    );

  // Get the last assistant message to check for draft order context
  const lastMessage = options?.conversationHistory?.[options.conversationHistory.length - 1];
  const hasDraftOrderContext = lastMessage?.role === 'assistant' &&
    (lastMessage.content.includes('تأكيد الطلب') || lastMessage.content.includes('هل تأكد الطلب'));

  // >>> Cancellation Detection (Task 4.1)
  // Arabic and English cancellation phrases
  const cancelKeywords = [
    'لا', 'إلغاء', 'الغاء', 'cancel', 'no', 'مش عايز', 'مش عاوز',
    'لأ', 'الغي', 'ألغي', 'كنسل', 'لا شكرا', 'لا شكراً', 'مش محتاج',
    'لا اريد', 'لا أريد', 'ارجع', 'تراجع', 'stop', 'nevermind', 'never mind'
  ];

  const normalizedMessage = userMessage.toLowerCase().trim();
  const isCancellation = cancelKeywords.some(kw =>
    normalizedMessage === kw.toLowerCase() ||
    normalizedMessage.startsWith(kw.toLowerCase() + ' ') ||
    normalizedMessage.endsWith(' ' + kw.toLowerCase())
  );

  // Handle cancellation when there's a pending draft order
  if (isCancellation && hasDraftOrderContext && supabase && options?.userId) {
    try {
      const cancelResult = await cancelOrder(supabase, options.userId);
      if (cancelResult.success) {
        return {
          reply: '❌ تم إلغاء الطلب.\nلو عايز تطلب حاجة تانية، قولي وأنا هساعدك! 😊',
          mode: 'simple',
          cancelledOrder: cancelResult.order
        };
      } else {
        return {
          reply: cancelResult.message,
          mode: 'simple'
        };
      }
    } catch (error: any) {
      // Task 7.2: Database error handling with Arabic messages and logging
      const errorMessage = error?.message || 'Unknown error';
      console.error('Cancellation error:', errorMessage);

      return {
        reply: '⚠️ حصل مشكلة أثناء إلغاء الطلب. يرجى المحاولة مرة أخرى.\n\nلو المشكلة استمرت، تواصل معانا على الإنستجرام.',
        mode: 'simple',
        error: {
          type: 'cancellation_error',
          message: errorMessage
        }
      };
    }
  }
  // <<< End Cancellation Detection

  // >>> Order Confirmation Detection (Task 4.4)
  const confirmKeywords = ['yes', 'confirm', 'ok', 'نعم', 'أكيد', 'تمام', 'اكد', 'تأكيد', 'موافق', 'حسناً', 'حسنا', 'اه', 'أه', 'ايوه', 'أيوه', 'اوك', 'أوك', 'ماشي'];
  const isConfirmation = confirmKeywords.some(kw => normalizedMessage === kw.toLowerCase().trim());

  // Task 7.3: Handle confirmation attempt when no draft order context exists
  if (isConfirmation && !hasDraftOrderContext && supabase && options?.userId) {
    // User sent confirmation but there's no pending draft order in conversation
    return {
      reply: '⚠️ لم أجد طلبًا معلقًا لتأكيده.\n\nلو عايز تطلب حاجة، قولي اسم المنتج والكمية وأنا هساعدك! 😊',
      mode: 'simple',
      error: { type: 'no_draft_order' }
    };
  }

  if (isConfirmation && hasDraftOrderContext && supabase && options?.userId) {
    try {
      // Use the confirmOrder function (Task 4.4)
      const confirmResult = await confirmOrder(supabase, options.userId);

      if (confirmResult.success) {
        // Fetch order items with product details for receipt
        const { data: orderItemsWithProducts } = await supabase
          .from('order_items')
          .select('*, products(id, title, description, price, currency)')
          .eq('order_id', confirmResult.order.id);

        return {
          reply: `✅ تم تأكيد طلبك بنجاح! 🎉\nرقم الطلب: ${confirmResult.order.metadata?.order_number || confirmResult.order.id}\nشكراً لاختيارك Sphinx Fit!`,
          confirmedOrder: {
            ...confirmResult.order,
            order_items: orderItemsWithProducts || confirmResult.orderItems
          },
          mode: 'simple'
        };
      }
    } catch (error: any) {
      // Task 7.2: Database error handling with Arabic messages and logging
      const errorMessage = error?.message || 'Unknown error';
      console.error('Confirmation error:', errorMessage);

      // Task 7.3: Handle no draft order scenario
      if (errorMessage.includes('No draft order')) {
        return {
          reply: '⚠️ لم أجد طلبًا معلقًا لتأكيده.\n\nلو عايز تطلب حاجة، قولي اسم المنتج والكمية وأنا هساعدك! 😊',
          mode: 'simple',
          error: { type: 'no_draft_order' }
        };
      }

      // Task 7.4: Order confirmation failure handling
      return {
        reply: '⚠️ حصل مشكلة أثناء تأكيد الطلب. يرجى المحاولة مرة أخرى.\n\nلو المشكلة استمرت، تواصل معانا على الإنستجرام.',
        mode: 'simple',
        error: {
          type: 'confirmation_error',
          message: errorMessage
        }
      };
    }
  }
  // <<< End Order Confirmation Logic


  // 1. Get context based on query type
  let docs: any[] = [];
  let products: any[] = [];

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
      try { docs = await querySimilar(supabase, userMessage, 5); } catch { docs = []; }

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

    // >>> SPECIFIC PRODUCT QUERY: Search for specific products mentioned in the message
    if (supabase) {
      // Common words to skip (not product names)
      const commonWords = [
        // Arabic common/filler words
        'عايز', 'محتاج', 'ممكن', 'فين', 'كام', 'سعر', 'ايه', 'إيه', 'هل', 'في',
        'عندكم', 'عندك', 'بكام', 'كم', 'متوفر', 'موجود', 'اشتري', 'اطلب', 'طلب',
        'شكرا', 'شكراً', 'كنت', 'عن', 'اسال', 'أسأل', 'بس', 'بالتس', 'عايزة',
        'طيب', 'طب', 'او', 'أو', 'ولا', 'يعني', 'كده', 'دي', 'ده', 'دا', 'اللي',
        'مين', 'ازاي', 'إزاي', 'ليه', 'علشان', 'عشان', 'لو', 'من', 'الى', 'إلى',
        'انا', 'أنا', 'احنا', 'إحنا', 'انت', 'أنت', 'انتي', 'هو', 'هي', 'هم',
        // English common words
        'the', 'a', 'is', 'what', 'how', 'much', 'price', 'do', 'you', 'have', 'want', 'need',
        'can', 'get', 'show', 'me', 'please', 'thanks', 'thank', 'or', 'and', 'with'
      ];

      // Helper function to deduplicate products by title, keeping highest priced
      const deduplicateProducts = (prods: any[]) => {
        const byTitle = new Map<string, any>();
        for (const p of prods) {
          const existing = byTitle.get(p.title);
          if (!existing || (p.price || 0) > (existing.price || 0)) {
            byTitle.set(p.title, p);
          }
        }
        return Array.from(byTitle.values());
      };

      // Extract potential product keywords (words 2+ chars that aren't common)
      const messageWords = userMessage
        .split(/\s+/)
        .filter(w => w.length >= 2 && !commonWords.includes(w.toLowerCase()))
        .sort((a, b) => b.length - a.length); // Prioritize longer words

      console.log('Product search keywords:', messageWords);

      // Try to find products matching keywords
      if (messageWords.length > 0) {
        // First try: search with the longest/most specific word
        for (const word of messageWords) {
          // Try direct match first, order by price DESC to get highest priced
          let { data: matchedProducts, error: searchErr } = await supabase
            .from('products')
            .select('id, title, description, price, currency, tags')
            .ilike('title', `%${word}%`)
            .order('price', { ascending: false })
            .limit(10);

          // If no direct match, try Arabic to English translation
          if (!searchErr && (!matchedProducts || matchedProducts.length === 0)) {
            const englishTranslations = translateArabicToEnglish(word);
            console.log(`Translating "${word}" to English:`, englishTranslations);

            for (const englishTerm of englishTranslations) {
              const translatedResult = await supabase
                .from('products')
                .select('id, title, description, price, currency, tags')
                .ilike('title', `%${englishTerm}%`)
                .order('price', { ascending: false })
                .limit(10);

              if (!translatedResult.error && translatedResult.data && translatedResult.data.length > 0) {
                console.log(`Found products via translation "${word}" → "${englishTerm}":`, translatedResult.data.map(p => p.title));
                matchedProducts = translatedResult.data;
                break;
              }
            }
          }

          if (!searchErr && matchedProducts && matchedProducts.length > 0) {
            console.log(`Found ${matchedProducts.length} products matching "${word}":`);
            matchedProducts.forEach((p, i) => {
              console.log(`  ${i + 1}. "${p.title}" - Price: ${p.price} ${p.currency || 'EGP'}`);
            });

            // If we found exactly 1 product, that's likely the one they want
            // If multiple, include all but prioritize exact matches and higher prices
            if (matchedProducts.length === 1) {
              products = matchedProducts;
              break;
            } else {
              // Score products by how well they match
              const scored = matchedProducts.map(p => {
                const titleLower = p.title.toLowerCase();
                const wordLower = word.toLowerCase();
                let score = 0;
                if (titleLower === wordLower) score = 100;
                else if (titleLower.includes(wordLower)) score = 80;
                else if (wordLower.includes(titleLower)) score = 60;
                else score = 40;
                return { ...p, score };
              });
              // Sort by score first, then by price (higher price = likely featured product)
              scored.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return (b.price || 0) - (a.price || 0);
              });
              // Deduplicate by title, keeping highest priced version
              products = deduplicateProducts(scored).slice(0, 3);
              console.log(`Selected best match: "${products[0]?.title}" - Price: ${products[0]?.price}`);
              break;
            }
          }
        }

        // If still no match, try the full message as a phrase for translation
        if (products.length === 0) {
          const fullPhraseTranslations = translateArabicToEnglish(userMessage);
          console.log(`Full message translation:`, fullPhraseTranslations);

          for (const englishTerm of fullPhraseTranslations) {
            const { data: phraseMatched, error: phraseErr } = await supabase
              .from('products')
              .select('id, title, description, price, currency, tags')
              .ilike('title', `%${englishTerm}%`)
              .order('price', { ascending: false })
              .limit(10);

            if (!phraseErr && phraseMatched && phraseMatched.length > 0) {
              console.log(`Found products via full phrase translation "${englishTerm}":`, phraseMatched.map(p => p.title));
              // Deduplicate by title, keeping highest priced
              products = deduplicateProducts(phraseMatched).slice(0, 3);
              break;
            }
          }
        }
      }

      // If no specific products found, try vector search
      if (products.length === 0) {
        docs = await querySimilar(supabase, userMessage, 5);
      }
    }
  } catch (err) {
    console.warn('Could not query docs/products, continuing without RAG:', err);
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

  // Add products list if available (from specific product search)
  if (products.length > 0) {
    contextText += '\n\n📦 المنتجات المطابقة للبحث:\n';
    products.forEach((p, i) => {
      contextText += `${i + 1}. ${p.title}`;
      if (p.price) contextText += ` - السعر: ${p.price} ${p.currency || 'EGP'}`;
      if (p.description) contextText += `\n   الوصف: ${p.description}`;
      if (p.tags && p.tags.length > 0) contextText += `\n   التصنيف: ${p.tags.join(', ')}`;
      contextText += '\n';
    });
    contextText += '\n⚠️ رد فقط بالمنتجات المذكورة أعلاه. لا تذكر منتجات أخرى.';
  }

  // Add vector search results if available (and no specific products found)
  if (docs.length > 0 && products.length === 0) {
    // Extract product info from vector search results
    const productDocs = docs.filter(d => d.metadata?.product_id || d.content?.includes('EGP') || d.content?.includes('جنيه'));
    const otherDocs = docs.filter(d => !d.metadata?.product_id && !d.content?.includes('EGP') && !d.content?.includes('جنيه'));

    if (productDocs.length > 0) {
      contextText += '\n\n📦 معلومات المنتجات:\n' +
        productDocs.map(d => `- ${d.content}`).join('\n');
    }

    if (otherDocs.length > 0) {
      contextText += '\n\nمعلومات إضافية:\n' +
        otherDocs.map(d => `- ${d.content}`).join('\n');
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

    // If we found items and have a supabase client, check authentication and create a DRAFT order
    if (orderDetails && orderDetails.isOrderIntent && Array.isArray(orderDetails.items) && orderDetails.items.length > 0 && supabase) {

      // Task 7.1: Authentication check for order operations
      // Return Arabic prompt to log in if not authenticated
      if (!options?.userId) {
        return {
          reply: '⚠️ عشان تقدر تعمل طلب، لازم تسجل دخول الأول.\n\nاضغط على "تسجيل الدخول" في أعلى الصفحة وبعدين ارجع كلمني تاني! 😊',
          mode: 'simple',
          requiresAuth: true
        };
      }

      // Task 4.2: Use matchProductsFromCatalog for product matching
      const matchedProducts = await matchProductsFromCatalog(supabase, orderDetails.items);

      // Log matched products for debugging
      console.log('Matched products:', JSON.stringify(matchedProducts, null, 2));
      console.log('Order details items:', JSON.stringify(orderDetails.items, null, 2));

      // Check for unmatched products and handle gracefully
      const unmatchedProducts = matchedProducts.filter(p => !p.matched);
      const hasUnmatchedProducts = unmatchedProducts.length > 0;

      // Build draft order items from matched products
      // Ensure quantity is taken from the correct extracted item
      const draftItems: DraftOrderItem[] = matchedProducts.map((mp, idx) => {
        const extractedItem = orderDetails.items[idx];
        const quantity = extractedItem?.quantity || 1;

        // Priority for price: 1. Matched product price, 2. Extracted price from user, 3. fallback 0
        const price = mp.matched ? mp.price : (extractedItem?.unit_price || 0);

        console.log(`Item ${idx}: ${mp.title}, qty: ${quantity}, price: ${price}, total: ${price * quantity} (Extracted price: ${extractedItem?.unit_price})`);

        return {
          product_id: mp.product_id,
          product_title: mp.matched ? mp.title : mp.original_query,
          quantity: quantity,
          price: price
        };
      });

      // Calculate total for verification
      const calculatedTotal = draftItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      console.log('Calculated total:', calculatedTotal);

      // Task 4.3: Use createDraftOrder function for draft order creation
      try {
        const draftResult = await createDraftOrder(
          supabase,
          options.userId,
          draftItems,
          orderDetails.shipping,
          options.userName
        );

        // Build order summary with matched product details
        const receiptLines: string[] = [];
        receiptLines.push('📦 **ملخص الطلب:**');

        draftItems.forEach((item, idx) => {
          const matchedProduct = matchedProducts[idx];
          const lineTotal = item.price * item.quantity;
          const matchStatus = matchedProduct.matched ? '' : ' ⚠️ (غير متوفر)';
          receiptLines.push(`${idx + 1}. ${item.product_title} × ${item.quantity} = ${lineTotal.toFixed(0)} EGP${matchStatus}`);
        });

        receiptLines.push('');
        receiptLines.push(`**المجموع:** ${draftResult.total.toFixed(0)} EGP`);

        // Add warning for unmatched products
        if (hasUnmatchedProducts) {
          receiptLines.push('');
          receiptLines.push('⚠️ **ملاحظة:** بعض المنتجات غير متوفرة حالياً وسيتم مراجعتها.');
        }

        // Add shipping details if provided
        if (orderDetails.shipping) {
          receiptLines.push('');
          receiptLines.push('📍 **تفاصيل الشحن:**');
          if (orderDetails.shipping.name) receiptLines.push(`الاسم: ${orderDetails.shipping.name}`);
          if (orderDetails.shipping.phone) receiptLines.push(`الهاتف: ${orderDetails.shipping.phone}`);
          if (orderDetails.shipping.address) receiptLines.push(`العنوان: ${orderDetails.shipping.address}`);
        }

        const receiptText = receiptLines.join('\n');

        // Include confirmation prompt in response
        const confirmPrompt = `\n\n**هل تأكد الطلب؟** (اكتب "نعم" للتأكيد أو "لا" للإلغاء)`;
        const finalReply = reply + '\n\n' + receiptText + confirmPrompt;

        // Return response with draftOrder in payload
        return {
          reply: finalReply,
          docs: products.length > 0 ? products : docs,
          mode: 'rag',
          draftOrder: {
            ...draftResult.order,
            order_items: draftResult.orderItems.map((item, idx) => ({
              ...item,
              products: {
                id: matchedProducts[idx]?.product_id,
                title: draftItems[idx]?.product_title || 'منتج',
                description: null,
                price: matchedProducts[idx]?.price || 0,
                currency: matchedProducts[idx]?.currency || 'EGP'
              }
            }))
          }
        } as any;
      } catch (draftError: any) {
        // Task 7.2: Database error handling with Arabic messages
        console.error('Failed to create draft order:', draftError.message);

        // Return user-friendly Arabic error message
        return {
          reply: '⚠️ حصل مشكلة أثناء إنشاء الطلب. يرجى المحاولة مرة أخرى.\n\nلو المشكلة استمرت، تواصل معانا على الإنستجرام.',
          mode: 'simple',
          error: {
            type: 'database_error',
            message: draftError.message
          }
        };
      }
    }
  } catch (e) {
    // Task 7.2: Log errors for debugging
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('Order extraction/creation failed:', errorMessage);

    // Continue with normal reply if extraction fails (non-critical)
  }

  return { reply, docs: products.length > 0 ? products : docs, mode: 'rag' };
}

// ============================================
// Order Management Utility Functions
// ============================================

/**
 * generateOrderNumber
 * - Generates a unique order number in format: SFX-{base36_timestamp}-{4_digit_random}
 * - Ensures uniqueness through timestamp + random combination
 * - Requirements: 2.2
 */
export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.floor(Math.random() * 9000) + 1000; // 4-digit random (1000-9999)
  return `SFX-${timestamp}-${random}`;
}

/**
 * OrderItem type for total calculation
 */
export interface OrderItemForTotal {
  price: number;
  quantity: number;
}

/**
 * calculateOrderTotal
 * - Calculates the total price for an order from its items
 * - Sum of (price × quantity) for all items
 * - Handles edge cases: empty items array returns 0, zero prices are valid
 * - Requirements: 2.4
 */
export function calculateOrderTotal(items: OrderItemForTotal[]): number {
  if (!items || items.length === 0) {
    return 0;
  }

  return items.reduce((total, item) => {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 0;
    return total + (price * quantity);
  }, 0);
}

/**
 * Types for draft order creation
 */
export interface ShippingAddress {
  name?: string;
  phone?: string;
  address?: string;
}

export interface DraftOrderItem {
  product_id: string | null;
  product_title: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  user_id: string;
  status: 'draft' | 'confirmed' | 'cancelled' | 'pending' | 'completed';
  total: number;
  currency: string;
  shipping_address: ShippingAddress | null;
  metadata: {
    order_number: string;
    created_via: 'chat-assistant';
    customer_name?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  price: number;
  metadata: Record<string, unknown>;
}

export interface DraftOrderResult {
  order: Order;
  orderItems: OrderItem[];
  orderNumber: string;
  total: number;
}

/**
 * createDraftOrder
 * - Creates a draft order in the database with status 'draft'
 * - Inserts order record and corresponding order_items records
 * - Includes all required metadata fields (order_number, created_via, customer_name)
 * - Returns complete order with items
 * - Requirements: 2.1, 2.3, 6.1, 6.2, 6.4
 */
export async function createDraftOrder(
  supabase: SupabaseClient,
  userId: string,
  items: DraftOrderItem[],
  shipping?: ShippingAddress,
  customerName?: string
): Promise<DraftOrderResult> {
  // Generate unique order number
  const orderNumber = generateOrderNumber();

  // Calculate total from items
  const total = calculateOrderTotal(items.map(item => ({
    price: item.price,
    quantity: item.quantity
  })));

  // Create order record
  const orderRecord = {
    user_id: userId,
    status: 'draft' as const,
    total: total,
    currency: 'EGP',
    shipping_address: shipping || null,
    metadata: {
      order_number: orderNumber,
      created_via: 'chat-assistant' as const,
      customer_name: customerName || undefined
    }
  };

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderRecord)
    .select()
    .single();

  if (orderError) {
    throw new Error(`Failed to create draft order: ${orderError.message}`);
  }

  // Create order items records
  const orderItemsRecords = items.map(item => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    price: item.price,
    metadata: {}
  }));

  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemsRecords)
    .select();

  if (itemsError) {
    // Rollback: delete the order if items insertion fails
    await supabase.from('orders').delete().eq('id', order.id);
    throw new Error(`Failed to create order items: ${itemsError.message}`);
  }

  return {
    order: order as Order,
    orderItems: orderItems as OrderItem[],
    orderNumber: orderNumber,
    total: total
  };
}

// Types for order extraction and product matching
export interface ExtractedOrderItem {
  product_title: string;
  quantity: number;
  unit_price?: number;
}

export interface ExtractedOrderDetails {
  items: ExtractedOrderItem[];
  shipping?: {
    name?: string;
    phone?: string;
    address?: string;
  };
  isOrderIntent: boolean;
}

export interface MatchedProduct {
  product_id: string | null;
  title: string;
  price: number;
  currency: string;
  matched: boolean;
  original_query: string;
}

/**
 * translateArabicToEnglish
 * - Wrapper for the productDictionary translateToEnglish function
 * - Translates Arabic product terms to English equivalents
 * - Returns array of possible English translations
 */
function translateArabicToEnglish(arabicText: string): string[] {
  return translateToEnglish(arabicText);
}

/**
 * matchProductsFromCatalog
 * - Queries the products table to find matches for extracted product titles.
 * - Uses ILIKE for case-insensitive partial matching.
 * - ENHANCED: Supports Arabic to English translation for product matching
 * - Returns matched products with id, title, price, currency, and matched flag.
 * - For unmatched products, returns matched: false with price: 0.
 */
export async function matchProductsFromCatalog(
  supabase: SupabaseClient,
  extractedItems: Array<{ product_title: string; quantity: number; unit_price?: number }>
): Promise<MatchedProduct[]> {
  const results: MatchedProduct[] = [];

  for (const item of extractedItems) {
    const searchTitle = item.product_title.trim();

    if (!searchTitle) {
      results.push({
        product_id: null,
        title: searchTitle,
        price: 0,
        currency: 'EGP',
        matched: false,
        original_query: item.product_title
      });
      continue;
    }

    try {
      // Step 1: Try exact match first (case-insensitive), order by price DESC to get highest priced
      let { data: products, error } = await supabase
        .from('products')
        .select('id, title, price, currency, description')
        .ilike('title', searchTitle)
        .order('price', { ascending: false })
        .limit(5);

      // Step 2: If no exact match, try partial match with wildcards
      if (!error && (!products || products.length === 0)) {
        const partialResult = await supabase
          .from('products')
          .select('id, title, price, currency, description')
          .ilike('title', `%${searchTitle}%`)
          .order('price', { ascending: false })
          .limit(5);

        products = partialResult.data;
        error = partialResult.error;
      }

      // Step 3: NEW - Try Arabic to English translation matching
      if (!error && (!products || products.length === 0)) {
        const englishTranslations = translateArabicToEnglish(searchTitle).filter(t => t.length > 2);
        console.log(`Arabic "${searchTitle}" translated to:`, englishTranslations);

        for (const englishTerm of englishTranslations) {
          const translatedResult = await supabase
            .from('products')
            .select('id, title, price, currency, description')
            .ilike('title', `%${englishTerm}%`)
            .order('price', { ascending: false }) // Reverted to DESC to find higher-priced "primary" versions first
            .limit(5);

          if (!translatedResult.error && translatedResult.data && translatedResult.data.length > 0) {
            console.log(`Found products matching "${englishTerm}":`, translatedResult.data.map(p => p.title));
            products = translatedResult.data;
            break;
          }
        }
      }

      // Step 4: If still no match, try matching with significant words (3+ chars)
      if (!error && (!products || products.length === 0)) {
        const words = searchTitle.split(/\s+/).filter(w => w.length >= 3);
        words.sort((a, b) => b.length - a.length);

        for (const word of words) {
          const genericWords = ['عايز', 'محتاج', 'ممكن', 'واحد', 'اتنين', 'تلاتة', 'كام', 'فين', 'ازاي'];
          if (genericWords.includes(word)) continue;

          // Try direct match first, order by price DESC
          let wordResult = await supabase
            .from('products')
            .select('id, title, price, currency, description')
            .ilike('title', `%${word}%`)
            .order('price', { ascending: false })
            .limit(5);

          // If no direct match, try translating the word
          if (!wordResult.error && (!wordResult.data || wordResult.data.length === 0)) {
            const wordTranslations = translateArabicToEnglish(word);
            for (const translation of wordTranslations) {
              wordResult = await supabase
                .from('products')
                .select('id, title, price, currency, description')
                .ilike('title', `%${translation}%`)
                .order('price', { ascending: false })
                .limit(5);

              if (!wordResult.error && wordResult.data && wordResult.data.length > 0) {
                console.log(`Word "${word}" → "${translation}" matched:`, wordResult.data.map(p => p.title));
                break;
              }
            }
          }

          if (!wordResult.error && wordResult.data && wordResult.data.length > 0) {
            products = wordResult.data;
            break;
          }
        }
      }

      if (error) {
        console.error('Product matching error:', error.message);
        results.push({
          product_id: null,
          title: searchTitle,
          price: 0,
          currency: 'EGP',
          matched: false,
          original_query: item.product_title
        });
        continue;
      }

      if (products && products.length > 0) {
        // Log all found products for debugging
        console.log(`Found ${products.length} products for "${searchTitle}":`);
        products.forEach((p, i) => {
          console.log(`  ${i + 1}. "${p.title}" - Price: ${p.price} ${p.currency || 'EGP'}`);
        });

        // If multiple products found, find the best match
        let bestMatch = products[0];

        if (products.length > 1) {
          // Score each product based on how well it matches the search and user price
          const searchLower = searchTitle.toLowerCase();
          const englishTerms = translateArabicToEnglish(searchTitle);
          const targetPrice = item.unit_price;
          let bestScore = -1;

          for (const product of products) {
            const titleLower = product.title.toLowerCase();
            let score = 0;

            // Exact match gets highest score
            if (titleLower === searchLower) {
              score += 100;
            }
            // Title contains full search term
            else if (titleLower.includes(searchLower)) {
              score += 80;
            }
            // Search term contains full title
            else if (searchLower.includes(titleLower)) {
              score += 70;
            }
            // Check English translation matches
            else {
              for (const englishTerm of englishTerms) {
                if (titleLower.includes(englishTerm.toLowerCase())) {
                  score += 75;
                  break;
                }
              }
            }

            // Price matching bonus
            if (targetPrice && product.price) {
              const priceDiff = Math.abs(product.price - targetPrice);
              if (priceDiff < 1) score += 50; // Exact price match
              else if (priceDiff < 50) score += 20; // Close price match
            }

            // Partial word matches
            if (score === 0) {
              const searchWords = searchLower.split(/\s+/);
              const titleWords = titleLower.split(/\s+/);
              const matchingWords = searchWords.filter((sw: string) =>
                titleWords.some((tw: string) => tw.includes(sw) || sw.includes(tw))
              );
              score += (matchingWords.length / Math.max(1, searchWords.length)) * 60;
            }

            // Prefer middle-priced items if no target price, 
            // or items closer to target if it exists
            if (score > bestScore) {
              bestScore = score;
              bestMatch = product;
            } else if (score === bestScore) {
              // Tie-breaker
              if (targetPrice) {
                const currentDiff = Math.abs(bestMatch.price - targetPrice);
                const newDiff = Math.abs(product.price - targetPrice);
                if (newDiff < currentDiff) bestMatch = product;
              } else {
                // Without target price, prefer the one with more content or more "standard" price
                if ((product.price || 0) > (bestMatch.price || 0)) bestMatch = product; // Prefer higher as "primary" model
              }
            }
          }
        }

        console.log(`Best match: "${bestMatch.title}" - Price: ${bestMatch.price} ${bestMatch.currency || 'EGP'} (Target: ${item.unit_price})`);

        results.push({
          product_id: bestMatch.id,
          title: bestMatch.title,
          price: bestMatch.price || 0,
          currency: bestMatch.currency || 'EGP',
          matched: true,
          original_query: item.product_title
        });
      } else {
        results.push({
          product_id: null,
          title: searchTitle,
          price: 0,
          currency: 'EGP',
          matched: false,
          original_query: item.product_title
        });
      }
    } catch (err: any) {
      console.error('Product matching exception:', err.message);
      results.push({
        product_id: null,
        title: searchTitle,
        price: 0,
        currency: 'EGP',
        matched: false,
        original_query: item.product_title
      });
    }
  }

  return results;
}

/**
 * parseOrderDetailsResponse
 * Pure function that parses the LLM response into structured order details.
 * This function is separated for testability.
 */
/**
 * parseOrderDetailsResponse
 * Pure function that parses the LLM response into structured order details.
 * Enhanced to handle Arabic decoding and potential Unicode escapes.
 */
export function parseOrderDetailsResponse(rawResponse: string): ExtractedOrderDetails {
  // Helper to safely clean and decode strings
  const cleanString = (s: any): string => {
    if (typeof s !== 'string') return '';
    try {
      // Handle escaped unicode if it appears as literal characters (e.g. \u062a)
      return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    } catch {
      return s;
    }
  };

  // Try to parse JSON from response
  try {
    const trimmed = rawResponse.trim();
    const j = JSON.parse(trimmed);

    // Ensure isOrderIntent is set
    const result: ExtractedOrderDetails = {
      items: Array.isArray(j.items) ? j.items.map((item: any) => ({
        product_title: cleanString(item.product_title || item.title || ''),
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || undefined
      })) : [],
      shipping: j.shipping ? {
        name: cleanString(j.shipping.name) || undefined,
        phone: cleanString(j.shipping.phone) || undefined,
        address: cleanString(j.shipping.address) || undefined
      } : undefined,
      isOrderIntent: Boolean(j.isOrderIntent || (j.items && j.items.length > 0))
    };
    return result;
  } catch {
    // Try to extract JSON substring
    const m = rawResponse.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const j = JSON.parse(m[0]);
        const result: ExtractedOrderDetails = {
          items: Array.isArray(j.items) ? j.items.map((item: any) => ({
            product_title: cleanString(item.product_title || item.title || ''),
            quantity: Number(item.quantity) || 1,
            unit_price: Number(item.unit_price) || undefined
          })) : [],
          shipping: j.shipping ? {
            name: cleanString(j.shipping.name) || undefined,
            phone: cleanString(j.shipping.phone) || undefined,
            address: cleanString(j.shipping.address) || undefined
          } : undefined,
          isOrderIntent: Boolean(j.isOrderIntent || (j.items && j.items.length > 0))
        };
        return result;
      } catch (e) {
        console.error('JSON parse error:', e);
        return { items: [], isOrderIntent: false };
      }
    }
    console.warn('Could not extract JSON from:', rawResponse.slice(0, 200));
    return { items: [], isOrderIntent: false };
  }
}

/**
 * extractOrderDetails
 * Asks the LLM to extract structured order information from a free-text user message.
 * Enhanced to support Arabic product names and shipping details
 * IMPROVED: More accurate extraction with better prompting
 * Returns: { items: [{ product_title, quantity, unit_price? }], shipping?: { name, address, phone }, isOrderIntent: boolean }
 */
export async function extractOrderDetails(userMessage: string): Promise<ExtractedOrderDetails> {
  // Build a more robust prompt that handles both English and Arabic
  const prompt = `أنت مساعد استخراج معلومات الطلبات. استخرج معلومات الطلب من رسالة المستخدم بصيغة JSON.

⚠️ قواعد مهمة جداً:
1. حدد أولاً: هل المستخدم يريد طلب/شراء منتج فعلاً؟
   - "عايز تيشيرت" = طلب (isOrderIntent: true)
   - "عندكم تيشيرت؟" = سؤال عن توفر (isOrderIntent: false)
   - "كام سعر التيشيرت؟" = سؤال عن سعر (isOrderIntent: false)
   - "عايز اشتري" أو "محتاج" = طلب (isOrderIntent: true)

2. استخرج اسم المنتج بالضبط كما ذكره المستخدم:
   - "عايز 2 تيشيرت أسود" → product_title: "تيشيرت أسود"
   - "محتاج شورت رياضي" → product_title: "شورت رياضي"
   - لا تضيف كلمات من عندك

3. الكمية:
   - "2 تيشيرت" → quantity: 2
   - "تيشيرت" بدون رقم → quantity: 1
   - "اتنين" أو "تلاتة" → حولها لأرقام

أرجع JSON بالشكل التالي فقط:
{
  "isOrderIntent": true,
  "items": [
    { 
      "product_title": "اسم المنتج بالضبط", 
      "quantity": 1
    }
  ],
  "shipping": {
    "name": "اسم المستقبل أو null",
    "phone": "رقم الهاتف أو null", 
    "address": "العنوان أو null"
  }
}

رسالة المستخدم:
${userMessage}

أرجع JSON فقط بدون أي نص إضافي:`;

  const raw = await callChatAnywhere([
    { role: 'system', content: 'أنت متخصص استخراج بيانات JSON. أرد فقط بـ JSON صحيح بدون تعليقات.' },
    { role: 'user', content: prompt }
  ], process.env.CHAT_MODEL || undefined);

  return parseOrderDetailsResponse(raw);
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
 * getPersonalizedRecommendations
 * - Generates product recommendations for a user based on their past order history.
 */
export async function getPersonalizedRecommendations(supabase: SupabaseClient, userId: string, k = 3) {
  try {
    // 1. Fetch IDs of the user's confirmed orders.
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'confirmed');

    if (ordersError) throw new Error(`Failed to fetch user's orders: ${ordersError.message}`);
    if (!orders || orders.length === 0) return [];

    const orderIds = orders.map(o => o.id);

    // 2. Fetch IDs of products from those orders.
    const { data: purchasedItems, error: itemsError } = await supabase
      .from('order_items')
      .select('product_id')
      .in('order_id', orderIds);

    if (itemsError) throw new Error(`Failed to fetch user's purchased items: ${itemsError.message}`);

    const purchasedProductIds = new Set((purchasedItems || []).map(item => item.product_id).filter(Boolean));
    if (purchasedProductIds.size === 0) {
      return []; // No purchase history, no recommendations.
    }

    // 3. Fetch the details of the purchased products to build a "taste profile".
    const { data: purchasedProducts, error: productsError } = await supabase
      .from('products')
      .select('id, title, description, tags')
      .in('id', Array.from(purchasedProductIds));

    if (productsError) throw new Error(`Failed to fetch product details: ${productsError.message}`);

    // 4. Create a "taste profile" string.
    const tasteProfile = (purchasedProducts || []).map(p => `${p.title} ${p.tags?.join(' ')} ${p.description}`).join('\n');
    if (!tasteProfile) {
      return [];
    }

    // 5. Use the taste profile to find similar products.
    const similarDocs = await querySimilar(supabase, tasteProfile, k + purchasedProductIds.size);

    // 6. Filter out products the user has already bought and return top K.
    const recommendations = similarDocs
      .filter(doc => doc.metadata?.product_id && !purchasedProductIds.has(doc.metadata.product_id))
      .slice(0, k);

    return recommendations;
  } catch (error: any) {
    console.error('Error generating personalized recommendations:', error.message);
    return [];
  }
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

// ============================================
// Order Confirmation/Cancellation Functions
// ============================================

/**
 * Result type for confirmOrder function
 */
export interface ConfirmOrderResult {
  order: Order;
  orderItems: OrderItem[];
  success: boolean;
}

/**
 * confirmOrder
 * - Finds the most recent draft order for a user
 * - Updates status to 'confirmed'
 * - Updates `updated_at` timestamp
 * - Fetches and returns order with items
 * - Requirements: 3.1, 6.3
 */
export async function confirmOrder(
  supabase: SupabaseClient,
  userId: string
): Promise<ConfirmOrderResult> {
  // Find the most recent draft order for this user
  const { data: draftOrder, error: findError } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (findError || !draftOrder) {
    throw new Error('No draft order found for user');
  }

  // Update order status to 'confirmed' and update timestamp
  const { data: confirmedOrder, error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'confirmed',
      updated_at: new Date().toISOString()
    })
    .eq('id', draftOrder.id)
    .select()
    .single();

  if (updateError || !confirmedOrder) {
    throw new Error(`Failed to confirm order: ${updateError?.message || 'Unknown error'}`);
  }

  // Fetch order items for the confirmed order
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', confirmedOrder.id);

  if (itemsError) {
    console.warn('Could not fetch order items:', itemsError.message);
  }

  return {
    order: confirmedOrder as Order,
    orderItems: (orderItems || []) as OrderItem[],
    success: true
  };
}

/**
 * Result type for cancelOrder function
 */
export interface CancelOrderResult {
  success: boolean;
  message: string;
  order?: Order;
}

/**
 * cancelOrder
 * - Finds the most recent draft order for a user
 * - Updates status to 'cancelled'
 * - Returns success/failure with message
 * - Requirements: 3.2, 6.3
 */
export async function cancelOrder(
  supabase: SupabaseClient,
  userId: string
): Promise<CancelOrderResult> {
  // Find the most recent draft order for this user
  const { data: draftOrder, error: findError } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (findError || !draftOrder) {
    return {
      success: false,
      message: 'لم يتم العثور على طلب معلق للإلغاء'
    };
  }

  // Update order status to 'cancelled' and update timestamp
  const { data: cancelledOrder, error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', draftOrder.id)
    .select()
    .single();

  if (updateError || !cancelledOrder) {
    return {
      success: false,
      message: `فشل في إلغاء الطلب: ${updateError?.message || 'خطأ غير معروف'}`
    };
  }

  return {
    success: true,
    message: 'تم إلغاء الطلب بنجاح',
    order: cancelledOrder as Order
  };
}

const agentModule = {
  createSupabaseClient,
  embedText,
  upsertDocuments,
  upsertProductDocuments,
  regenerateAllProductEmbeddings,
  querySimilar,
  getAllProducts,
  callChatAnywhere,
  handleChat,
  recommendProducts,
  simpleChat,
  matchProductsFromCatalog,
  extractOrderDetails,
  generateOrderNumber,
  calculateOrderTotal,
  createDraftOrder,
  confirmOrder,
  cancelOrder
};

export default agentModule;

// Re-export product dictionary functions for external use
export { translateToEnglish, buildSearchQueries, generateBilingualProductText } from './productDictionary';

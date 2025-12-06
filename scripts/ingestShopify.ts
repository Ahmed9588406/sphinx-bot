/*
  Shopify ingestion script
  - Fetches products from Shopify Admin API and upserts them to Supabase `documents` table
  - Usage (locally): compile to JS or run with ts-node

  Required env vars: SHOPIFY_STORE_NAME, SHOPIFY_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
*/
import fetch from 'node-fetch';
import { createSupabaseClient, upsertDocuments, embedText } from '../lib/agent';

async function fetchAllProducts() {
  const store = process.env.SHOPIFY_STORE_NAME;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!store || !token) throw new Error('Missing SHOPIFY_STORE_NAME or SHOPIFY_ACCESS_TOKEN');

  const url = `https://${store}/admin/api/2023-10/products.json?limit=250`;
  const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': token } });
  if (!res.ok) throw new Error(`Shopify fetch error ${res.status}`);
  const json = await res.json() as { products?: unknown[] };
  return json.products || [];
}

function productToDocument(p: any) {
  const title = p.title || '';
  const body = p.body_html || p.title || '';
  const variants = (p.variants || []).map((v: any) => ({ sku: v.sku, price: v.price, inventory_quantity: v.inventory_quantity }));
  const images = (p.images || []).map((i: any) => i.src);
  const metadata = {
    shopify_id: p.id,
    handle: p.handle,
    variants,
    tags: p.tags,
    images
  };
  return {
    content: `${title}\n\n${body}`,
    metadata
  };
}

async function main() {
  const products = await fetchAllProducts();
  const supabase = createSupabaseClient();
  if (!supabase) throw new Error('Failed to create Supabase client');

  // Log chosen embedding provider
  console.log('Using embedding provider:', process.env.EMBEDDING_PROVIDER || 'openai');

  // Prepare docs and compute embeddings explicitly (so we can log or adapt per item)
  const docs = [] as { content: string; metadata: Record<string, unknown>; embedding?: number[] }[];
  for (const p of products) {
    const doc = productToDocument(p);
    try {
      const emb = await embedText(doc.content);
      docs.push({ content: doc.content, metadata: doc.metadata, embedding: emb });
    } catch (err) {
      console.error('Embedding failed for product', (p as { id?: unknown }).id, err);
      // still push without embedding; upsertDocuments will try to embed if needed
      docs.push({ content: doc.content, metadata: doc.metadata });
    }
  }

  const res = await supabase.from('documents').insert(docs).select('*');
  if (res.error) throw res.error;
  console.log('Inserted documents count:', Array.isArray(res.data) ? res.data.length : 0);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

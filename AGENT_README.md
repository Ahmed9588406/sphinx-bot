# Sphinx Fit — Customer Support Smart Agent

This document describes a recommended architecture, setup, and helper library to build a customer-support smart agent for Sphinx Fit. The agent answers order queries, stock questions, and makes product recommendations. It is designed to be integrated with Shopify and to use a vector store (Supabase is recommended) for retrieval-augmented responses.

Goals
- Respond to user order and stock queries using authoritative company data (Shopify + internal DB).
- Provide personalized product recommendations using vector search over product descriptions, reviews, and catalog metadata.
- Use a modern chat LLM for generation (the project currently uses ChatAnywhere at `https://api.chatanywhere.tech/v1/chat/completions`).
- Keep architecture modular so you can switch vector DBs (Supabase / Pinecone / Weaviate) and embedding providers later.

High-level architecture
- Data sources
  - Shopify Catalog & Orders: canonical source for products and order status.
  - Internal data (returns, policies, sales events, best-sellers list).
  - Optionally: CRM/user history for personalization.
- Pipeline components
  1. Ingestion: fetch products/orders from Shopify and create documents.
  2. Embeddings: run text through an embedding model (OpenAI or other) producing dense vectors.
  3. Vector store: store embeddings + metadata in Supabase (pgvector) or other vector DB.
  4. Query & RAG: for incoming chat, embed the user message, retrieve relevant docs, and send them as context to ChatAnywhere.
  5. Formatter/finalizer: post-process assistant output (Egyptian Arabic, brand tone) and attach links/CTAs.

Why Supabase? (Recommended default)
- Single vendor: Postgres + pgvector inside Supabase makes it easy to keep embeddings next to relational data (orders, SKUs). It is cost-effective and supports SQL-based ranking via `ORDER BY embedding <-> query_embedding` when pgvector is set up.
- Familiar SQL allows flexible queries (join with `orders` table to confirm status).

What you'll find in this repo
- `.env.example` - environment variables needed.
- `lib/agent.ts` - TypeScript helper library with the main functions. Each function is documented with usage notes and expected side-effects.

Quick Setup (development)
1. Install dependencies (example):

```powershell
cd C:\Users\Ahmed\Desktop\sphinx\sphinx_fit
npm install @supabase/supabase-js node-fetch
```

2. Create and fill `.env` from `.env.example` (keys are required):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or anon key for client-safe ops — use service role for server ingestion)
- `SHOPIFY_STORE_NAME` (e.g., `my-shop.myshopify.com`)
- `SHOPIFY_ADMIN_API_KEY` / `SHOPIFY_ADMIN_API_PASSWORD` OR `SHOPIFY_ACCESS_TOKEN`
- `CHAT_ANYWHERE_API_KEY` (your key for ChatAnywhere)
- `EMBEDDING_PROVIDER` (e.g., `openai` or `custom`)
- `OPENAI_API_KEY` (if using OpenAI embeddings)

3. Run local dev server (Next.js):

```powershell
npm run dev
```

Core table schema (Supabase / Postgres + pgvector)
You should create a `documents` table that stores content, metadata and embeddings. Example SQL (requires pgvector extension):

```sql
-- enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  metadata jsonb,
  embedding vector(1536) -- adjust dims to your embedding model
);

-- helper RPC function (example) to match nearest neighbors
CREATE OR REPLACE FUNCTION public.match_documents(query_embedding vector, match_count int)
RETURNS TABLE (id uuid, content text, metadata jsonb, score float8) AS $$
  SELECT id, content, metadata, 1 - (embedding <#> query_embedding) as score
  FROM public.documents
  ORDER BY embedding <-> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql STABLE;
```

Notes
- You must choose an embedding dimension compatible with the embedding model you use. The example assumes 1536 (OpenAI older models) but newer models have different dims.
- If you use Supabase, run the SQL above using the SQL editor in the Supabase dashboard (or via migrations).

Security
- Never store API keys in repo; use environment variables.
- Use the Supabase Service Role key only on server-side code when performing ingestion or schema changes.

Integration with Shopify (overview)
1. Use Shopify Admin REST or GraphQL to pull products (and orders). Use the Admin API access token for server-server calls.
2. For each product, build a document containing: product title, description, SKU, price, inventory quantity, tags, and image url(s). Save the product id in metadata.
3. Generate embeddings for the product copy and upsert into `documents` table with metadata.
4. For order inquiries, fetch order status live from Shopify using order ID (never rely only on vector store for authoritative order information).

How `lib/agent.ts` helps
- `createSupabaseClient()` — creates a Supabase client from env vars.
- `embedText()` — generic embedding wrapper (OpenAI or custom provider).
- `upsertDocuments()` — ensures docs (with embeddings) are stored in Supabase.
- `querySimilar()` — returns nearest documents using the RPC function in SQL.
- `handleChat()` — main routine: gather relevant docs, craft a system prompt in Egyptian Arabic referencing Sphinx Fit policy & best-seller info, then call ChatAnywhere and return a reply.
- `recommendProducts()` — quick helper to return top-K product suggestions using vector search.

Next steps (recommended roadmap)
1. Create Supabase project and run the SQL migrations above.
2. Install dependencies and wire `.env`.
3. Implement an ingestion worker to periodically sync Shopify catalog to the vector store.
4. Add authentication/ratelimiting for chat endpoints.
5. Build a small Next.js API route that wraps `handleChat` and authenticates incoming requests.

If you'd like, I can now:
- scaffold a Next.js API route that calls `lib/agent.ts`'s `handleChat`;
- add a Shopify ingestion script that reads products and upserts them into Supabase;
- or create the Supabase SQL migration files.

**Frontend usage**

- **Endpoint:** `POST /api/chat`
- **Payload:** JSON object `{ "message": string, "customerContext"?: string }`.
- **Response:** JSON `{ "reply": string, "docs": Array }` where `reply` is the assistant text and `docs` are the retrieved documents used as context.

Example client code (browser / Next.js client component):

```ts
async function sendMessage(message: string) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  return res.json();
}

// Usage
sendMessage('فين پوشتي اللي طلبتها؟').then(r => console.log(r.reply));
```

Notes and best practices
- Always perform authentication and rate-limiting on the `/api/chat` endpoint if exposed publicly.
- For order-specific queries, prefer to attach `customerContext` containing `order_id` or customer identifiers so the server can fetch authoritative status from Shopify rather than relying on vector search alone.
- Keep response sanitization server-side: if the model suggests links or actions, ensure they are validated before returning to the user.

---
File: `lib/agent.ts` contains function-level documentation for every exported function. See that file for implementation details.

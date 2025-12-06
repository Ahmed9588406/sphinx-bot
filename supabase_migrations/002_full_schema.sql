-- 002_full_schema.sql
-- Detailed schema for Sphinx Fit: users, conversations, messages,
-- products, orders, documents (vectors), and helper functions/triggers.
-- Run in Supabase SQL editor or via migrations.

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector for embeddings

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  name text,
  phone text,
  avatar_url text,
  role text NOT NULL DEFAULT 'customer', -- customer | admin | agent
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Conversations and messages (chat history)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  title text,
  status text NOT NULL DEFAULT 'open', -- open | pending | closed
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender text NOT NULL, -- 'user' | 'agent' | 'system'
  sender_id uuid, -- optional reference to `users.id` for known senders
  content text NOT NULL,
  -- optional precomputed embedding for message-level retrieval
  embedding vector(1536),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Full-text search column for messages (optional, maintained by application)
-- CREATE INDEX messages_content_fts_idx ON public.messages USING gin (to_tsvector('english', content));

-- ---------------------------------------------------------------------------
-- Documents (vector store for products, policies, FAQs, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text, -- e.g., 'product', 'policy', 'faq', 'review'
  source_id text, -- optional external id (e.g., shopify product id)
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Recommended IVFFlat index for vector similarity (adjust lists as needed)
-- Note: creating an ivfflat index requires specifying the operator class.
-- If the database is small or you don't want to create an ivfflat index, skip this.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'documents' AND indexname = 'documents_embedding_ivfflat_idx'
  ) THEN
    EXECUTE 'CREATE INDEX documents_embedding_ivfflat_idx ON public.documents USING ivfflat (embedding vector_l2_ops) WITH (lists = 100)';
  END IF;
EXCEPTION WHEN undefined_function THEN
  -- ivfflat may not be available in some setups; ignore if unsupported
  RAISE NOTICE 'ivfflat index not created (possibly unsupported in this DB environment)';
END$$;

-- RPC to get nearest documents by embedding
CREATE OR REPLACE FUNCTION public.match_documents(query_embedding vector, match_count int)
RETURNS TABLE (id uuid, source text, source_id text, content text, metadata jsonb, score float8) AS $$
  SELECT id, source, source_id, content, metadata, 1 - (embedding <#> query_embedding) as score
  FROM public.documents
  WHERE embedding IS NOT NULL
  ORDER BY embedding <-> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------------
-- Products & Inventory (Shopify mapping)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_id bigint UNIQUE,
  title text NOT NULL,
  handle text,
  description text,
  price numeric(10,2),
  currency text,
  tags text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  shopify_variant_id bigint UNIQUE,
  sku text,
  price numeric(10,2),
  inventory_quantity int,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  url text,
  alt text,
  position int
);

-- ---------------------------------------------------------------------------
-- Orders and order items (Shopify mapping)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_id bigint UNIQUE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text,
  total numeric(12,2),
  currency text,
  shipping_address jsonb,
  billing_address jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity int NOT NULL DEFAULT 1,
  price numeric(10,2),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Indexes and constraints for performance
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_documents_source ON public.documents(source);
CREATE INDEX IF NOT EXISTS idx_products_shopify_id ON public.products(shopify_id);
CREATE INDEX IF NOT EXISTS idx_orders_shopify_id ON public.orders(shopify_id);

-- JSONB GIN indexes for fast metadata queries
CREATE INDEX IF NOT EXISTS documents_metadata_gin ON public.documents USING gin (metadata jsonb_path_ops);
CREATE INDEX IF NOT EXISTS users_metadata_gin ON public.users USING gin (metadata jsonb_path_ops);

-- ---------------------------------------------------------------------------
-- Trigger helpers: keep updated_at columns current
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Attach trigger to common tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_set_timestamp') THEN
    CREATE TRIGGER users_set_timestamp BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'conversations_set_timestamp') THEN
    CREATE TRIGGER conversations_set_timestamp BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'products_set_timestamp') THEN
    CREATE TRIGGER products_set_timestamp BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'orders_set_timestamp') THEN
    CREATE TRIGGER orders_set_timestamp BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- Example utility: upsert_user (creates or updates a user by email)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_user(p_email text, p_name text DEFAULT NULL, p_phone text DEFAULT NULL, p_meta jsonb DEFAULT '{}'::jsonb)
RETURNS public.users LANGUAGE plpgsql AS $$
DECLARE
  u public.users%ROWTYPE;
BEGIN
  SELECT * INTO u FROM public.users WHERE email = p_email FOR UPDATE;
  IF FOUND THEN
    UPDATE public.users SET name = COALESCE(p_name, name), phone = COALESCE(p_phone, phone), metadata = metadata || p_meta WHERE id = u.id;
    RETURN (SELECT * FROM public.users WHERE id = u.id);
  ELSE
    INSERT INTO public.users (email, name, phone, metadata) VALUES (p_email, p_name, p_phone, p_meta) RETURNING * INTO u;
    RETURN u;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Example utility: append_message (adds a message and updates conversation.last_message_at)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.append_message(
  p_conversation uuid,
  p_sender text,
  p_content text,
  p_sender_id uuid DEFAULT NULL,
  p_embedding vector DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS public.messages LANGUAGE plpgsql AS $$
DECLARE
  m public.messages%ROWTYPE;
BEGIN
  INSERT INTO public.messages (conversation_id, sender, sender_id, content, embedding, metadata)
    VALUES (p_conversation, p_sender, p_sender_id, p_content, p_embedding, p_meta) RETURNING * INTO m;
  UPDATE public.conversations SET last_message_at = now(), updated_at = now() WHERE id = p_conversation;
  RETURN m;
END;
$$;

-- ---------------------------------------------------------------------------
-- End of migration
-- ---------------------------------------------------------------------------

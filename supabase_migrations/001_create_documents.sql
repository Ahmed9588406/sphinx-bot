-- Migration: create documents table and match_documents RPC
-- Run this in Supabase SQL editor or via migrations

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  metadata jsonb,
  embedding vector(1536)
);

CREATE OR REPLACE FUNCTION public.match_documents(query_embedding vector, match_count int)
RETURNS TABLE (id uuid, content text, metadata jsonb, score float8) AS $$
  SELECT id, content, metadata, 1 - (embedding <#> query_embedding) as score
  FROM public.documents
  ORDER BY embedding <-> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql STABLE;

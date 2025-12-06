import { NextResponse } from 'next/server';
import { createSupabaseClient, embedText } from '../../../lib/agent';

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-api-key');
  const expected = process.env.TEST_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.API_KEY;
  if (!expected) {
    return NextResponse.json({ error: 'Server not configured with TEST_API_KEY' }, { status: 500 });
  }
  if (apiKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const text = body?.text;
    if (!text) return NextResponse.json({ error: 'Missing text in body' }, { status: 400 });

    // Create embedding using same helper used by ingestion
    const emb = await embedText(String(text));
    return NextResponse.json({ embedding_length: emb.length, embedding: emb });
  } catch (err: any) {
    console.error('test-embeddings error', err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

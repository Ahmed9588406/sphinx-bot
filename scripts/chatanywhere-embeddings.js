// scripts/chatanywhere-embeddings.js
// Node script to call ChatAnywhere/OpenAI-compatible embeddings endpoint
// Usage: set env vars CHAT_ANYWHERE_API_KEY and CHAT_ANYWHERE_API_URL (optional) then run:
//    node scripts/chatanywhere-embeddings.js

(async function(){
  try {
    const apiKey = process.env.CHAT_ANYWHERE_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('Missing CHAT_ANYWHERE_API_KEY or OPENAI_API_KEY in environment');
      process.exit(1);
    }

    const base = process.env.CHAT_ANYWHERE_API_URL || process.env.OPENAI_API_BASE || 'https://api.chatanywhere.tech/v1';
    const embedUrl = (base.endsWith('/v1') || base.endsWith('/v1/')) ? `${base.replace(/\/$/, '')}/embeddings` : `${base.replace(/\/$/, '')}/v1/embeddings`;

    const model = process.env.CHAT_ANYWHERE_EMBEDDING_MODEL || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

    const singleText = 'This is a test embedding from ChatAnywhere via Node.js';
    console.log('Embedding single text using', embedUrl, 'model', model);

    const res1 = await fetch(embedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ input: singleText, model })
    });

    if (!res1.ok) {
      const t = await res1.text();
      throw new Error(`Embedding error: ${res1.status} ${t}`);
    }
    const j1 = await res1.json();
    const emb1 = j1?.data?.[0]?.embedding || j1?.embedding;
    console.log('Single embedding length:', emb1?.length || 0);

    const texts = ['First text', 'Second text', 'Third text'];
    const res2 = await fetch(embedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ input: texts, model })
    });
    if (!res2.ok) {
      const t = await res2.text();
      throw new Error(`Batch embedding error: ${res2.status} ${t}`);
    }
    const j2 = await res2.json();
    const items = j2?.data || (Array.isArray(j2) ? j2 : null);
    if (!items) {
      console.warn('Unexpected batch response shape:', JSON.stringify(j2).slice(0,500));
    } else {
      for (let i=0;i<items.length;i++){
        console.log(`text ${i} embedding length:`, items[i]?.embedding?.length || 0);
      }
    }

    console.log('Done');
  } catch (err) {
    console.error('Error running embeddings script:', err);
    process.exit(1);
  }
})();

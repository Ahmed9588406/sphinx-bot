"""
chatanywhere_embeddings.py

Demonstrates creating embeddings against ChatAnywhere's OpenAI-compatible API endpoint
using the OpenAI Python client. This script can be used to test the embedding endpoint
and verify embedding vector lengths.

Usage:
  # set env vars (example)
  export OPENAI_API_KEY="sk-..." \
         OPENAI_API_BASE="https://api.chatanywhere.tech/v1"

  python scripts/chatanywhere_embeddings.py

You can also set `CHAT_ANYWHERE_API_KEY` and `CHAT_ANYWHERE_API_URL` instead of the
OpenAI-named env vars — the script will prefer `OPENAI_API_KEY`/`OPENAI_API_BASE` but
fall back to `CHAT_ANYWHERE_API_KEY`/`CHAT_ANYWHERE_API_URL`.

Install dependencies:
  pip install --upgrade openai

Note: Do NOT commit real API keys into source control. Use environment variables.
"""
from __future__ import annotations
import os
import sys
from typing import List

try:
    # New OpenAI Python client import pattern
    from openai import OpenAI
except Exception as e:
    print("Missing OpenAI Python client. Install with: pip install openai", file=sys.stderr)
    raise


def get_client() -> OpenAI:
    # Prefer the standard OpenAI env vars, but allow ChatAnywhere-specific names as fallback
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("CHAT_ANYWHERE_API_KEY")
    base = os.getenv("OPENAI_API_BASE") or os.getenv("CHAT_ANYWHERE_API_URL") or "https://api.chatanywhere.tech/v1"

    if not api_key:
        raise SystemExit(
            "Missing API key. Set OPENAI_API_KEY or CHAT_ANYWHERE_API_KEY in your environment."
        )

    # The OpenAI client accepts api_key and base_url parameters for service compatibility.
    client = OpenAI(api_key=api_key, base_url=base)
    return client


def embed_single_text(client: OpenAI, text: str, model: str = "text-embedding-3-small") -> List[float]:
    resp = client.embeddings.create(model=model, input=text)
    # Typical OpenAI-compatible response: resp.data[0].embedding
    emb = resp.data[0].embedding
    return emb


def embed_batch(client: OpenAI, texts: List[str], model: str = "text-embedding-3-small") -> List[List[float]]:
    resp = client.embeddings.create(model=model, input=texts)
    embeddings = [item.embedding for item in resp.data]
    return embeddings


def main():
    client = get_client()

    print("Creating single embedding for sample text...")
    emb = embed_single_text(client, "This is a test embedding from ChatAnywhere/OpenAI-compatible API")
    print("Embedding length:", len(emb))

    texts = ["First text", "Second text", "Third text"]
    print("Creating batch embeddings for", len(texts), "texts...")
    batch = embed_batch(client, texts)
    for i, e in enumerate(batch):
        print(f"text {i} embedding length: {len(e)}")


if __name__ == "__main__":
    main()

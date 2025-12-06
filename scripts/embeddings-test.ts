import 'dotenv/config';

// Global handler to surface unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

async function main() {
  console.log('--- Embedding Test Runner ---');
  console.log('EMBEDDING_PROVIDER:', process.env.EMBEDDING_PROVIDER || '(not set, defaulting to openai)');

  // Dynamic import via file URL avoids Node ESM resolution quirks when using ts-node/esm
  let agentModule: any;
  try {
    agentModule = await import(new URL('../lib/agent.ts', import.meta.url).href);
  } catch (importErr) {
    console.error('Failed to import lib/agent.ts:', importErr);
    process.exit(1);
  }
  const { embedText } = agentModule;

  const text = process.argv.slice(2).join(' ') || 'Test embedding from TypeScript runner';
  console.log('Embedding text:', text);
  try {
    const emb: number[] = await embedText(text);
    console.log('Embedding length:', emb.length);
    console.log('First 8 dims:', emb.slice(0, 8));
  } catch (err: any) {
    console.error('Error creating embedding:');
    console.error('  message:', err?.message || err);
    if (err?.stack) console.error('  stack:', err.stack);
    process.exit(1);
  }
}

main();

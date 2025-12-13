/**
 * Script to regenerate product embeddings with bilingual (Arabic + English) content
 * 
 * This script:
 * 1. Fetches all products from the database
 * 2. Generates bilingual content using the product dictionary
 * 3. Creates new embeddings that understand both Arabic and English queries
 * 
 * Run with: npx ts-node scripts/regenerate-embeddings.ts
 * Or: npx tsx scripts/regenerate-embeddings.ts
 */

import 'dotenv/config';
import { createSupabaseClient, regenerateAllProductEmbeddings } from '../lib/agent';

async function main() {
  console.log('='.repeat(60));
  console.log('Product Embedding Regeneration Script');
  console.log('='.repeat(60));
  console.log('');
  
  // Check environment
  if (!process.env.SUPABASE_URL) {
    console.error('❌ SUPABASE_URL not set in environment');
    process.exit(1);
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.API_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY or API_KEY not set in environment');
    process.exit(1);
  }
  
  if (!process.env.CHAT_ANYWHERE_API_KEY && !process.env.OPENAI_API_KEY) {
    console.error('❌ No embedding API key found (CHAT_ANYWHERE_API_KEY or OPENAI_API_KEY)');
    process.exit(1);
  }
  
  console.log('✓ Environment configured');
  console.log(`  - Supabase URL: ${process.env.SUPABASE_URL?.slice(0, 30)}...`);
  console.log(`  - Embedding Provider: ${process.env.EMBEDDING_PROVIDER || 'openai'}`);
  console.log('');
  
  // Create Supabase client
  const supabase = createSupabaseClient();
  if (!supabase) {
    console.error('❌ Failed to create Supabase client');
    process.exit(1);
  }
  
  console.log('✓ Supabase client created');
  console.log('');
  
  try {
    console.log('Starting embedding regeneration...');
    console.log('This will create bilingual embeddings for better Arabic search.');
    console.log('');
    
    const results = await regenerateAllProductEmbeddings(supabase);
    
    console.log('');
    console.log('='.repeat(60));
    console.log(`✅ Successfully regenerated ${results.length} product embeddings`);
    console.log('='.repeat(60));
    console.log('');
    console.log('The chat should now better understand Arabic product queries like:');
    console.log('  - "التراك بانتس" → Track Pants');
    console.log('  - "تيشيرت رياضي" → Performance Tee');
    console.log('  - "هودي أسود" → Workout Hoodie black');
    console.log('');
    
  } catch (error: any) {
    console.error('');
    console.error('❌ Error regenerating embeddings:', error.message);
    console.error('');
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

main();

import { NextResponse } from 'next/server';
import { createSupabaseClient, embedText } from '../../../../lib/agent';

export const runtime = 'nodejs';

/**
 * POST /api/products/regenerate-embeddings
 * Regenerates embeddings for all products in the database.
 * This fixes products that have zero/placeholder embeddings.
 */
export async function POST() {
  try {
    const supabase = createSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // 1. Get all products
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, title, description, price, currency, tags');

    if (fetchError) throw fetchError;
    if (!products || products.length === 0) {
      return NextResponse.json({ message: 'No products found', updated: 0 });
    }

    // 2. Process each product
    const results: { id: string; title: string; success: boolean; error?: string }[] = [];
    
    for (const product of products) {
      try {
        // Create rich text for embedding
        const contentForEmbedding = [
          product.title,
          product.description || '',
          product.tags?.join(', ') || ''
        ].filter(Boolean).join('. ');

        // Generate embedding
        const embedding = await embedText(contentForEmbedding);

        // Check if document already exists for this product
        const { data: existingDoc } = await supabase
          .from('documents')
          .select('id')
          .eq('source', 'product')
          .eq('source_id', product.id)
          .single();

        if (existingDoc) {
          // Update existing document
          const { error: updateError } = await supabase
            .from('documents')
            .update({
              content: contentForEmbedding,
              metadata: {
                product_id: product.id,
                title: product.title,
                price: product.price,
                currency: product.currency || 'EGP',
                tags: product.tags || []
              },
              embedding
            })
            .eq('id', existingDoc.id);

          if (updateError) throw updateError;
        } else {
          // Insert new document
          const { error: insertError } = await supabase
            .from('documents')
            .insert({
              source: 'product',
              source_id: product.id,
              content: contentForEmbedding,
              metadata: {
                product_id: product.id,
                title: product.title,
                price: product.price,
                currency: product.currency || 'EGP',
                tags: product.tags || []
              },
              embedding
            });

          if (insertError) throw insertError;
        }

        results.push({ id: product.id, title: product.title, success: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id: product.id, title: product.title, success: false, error: msg });
      }
    }

    // 3. Also clean up orphaned documents (products that no longer exist)
    // Get all product IDs
    const productIds = products.map(p => p.id);
    
    // Delete documents where source_id doesn't match any product
    const { error: cleanupError } = await supabase
      .from('documents')
      .delete()
      .eq('source', 'product')
      .not('source_id', 'in', `(${productIds.join(',')})`);

    if (cleanupError) {
      console.warn('Cleanup warning:', cleanupError.message);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      message: `Processed ${products.length} products`,
      successful,
      failed,
      results
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('POST /api/products/regenerate-embeddings error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

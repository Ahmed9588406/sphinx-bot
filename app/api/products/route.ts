import { NextResponse } from 'next/server';
import { createSupabaseClient, embedText } from '../../../lib/agent';

export const runtime = 'nodejs';

// Type for product creation
interface ProductInput {
  title: string;
  description?: string;
  price?: number;
  currency?: string;
  tags?: string[];
  shopify_id?: number;
  handle?: string;
  variants?: Array<{
    sku?: string;
    price?: number;
    inventory_quantity?: number;
  }>;
  images?: Array<{
    url: string;
    alt?: string;
  }>;
}

/**
 * GET /api/products - List all products
 */
export async function GET(req: Request) {
  try {
    const supabase = createSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data, error, count } = await supabase
      .from('products')
      .select('*, product_variants(*), product_images(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ 
      products: data, 
      total: count,
      limit,
      offset 
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('GET /api/products error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/products - Create a new product with auto-generated embeddings
 */
export async function POST(req: Request) {
  try {
    const supabase = createSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body: ProductInput = await req.json();
    
    // Validate required fields
    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // 1. Insert the product
    const productData = {
      title: body.title,
      description: body.description || null,
      price: body.price || null,
      currency: body.currency || 'EGP',
      tags: body.tags || [],
      shopify_id: body.shopify_id || null,
      handle: body.handle || body.title.toLowerCase().replace(/\s+/g, '-'),
      metadata: {}
    };

    const { data: product, error: productError } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single();

    if (productError) throw productError;

    // 2. Insert variants if provided
    if (body.variants && body.variants.length > 0) {
      const variantsData = body.variants.map(v => ({
        product_id: product.id,
        sku: v.sku || null,
        price: v.price || body.price || null,
        inventory_quantity: v.inventory_quantity || 0,
        metadata: {}
      }));

      const { error: variantsError } = await supabase
        .from('product_variants')
        .insert(variantsData);

      if (variantsError) {
        console.warn('Failed to insert variants:', variantsError.message);
      }
    }

    // 3. Insert images if provided
    if (body.images && body.images.length > 0) {
      const imagesData = body.images.map((img, idx) => ({
        product_id: product.id,
        url: img.url,
        alt: img.alt || body.title,
        position: idx
      }));

      const { error: imagesError } = await supabase
        .from('product_images')
        .insert(imagesData);

      if (imagesError) {
        console.warn('Failed to insert images:', imagesError.message);
      }
    }

    // 4. Generate embedding and create document for vector search
    let embeddingCreated = false;
    try {
      // Create rich text content for embedding
      const contentForEmbedding = [
        body.title,
        body.description || '',
        body.tags?.join(', ') || ''
      ].filter(Boolean).join('. ');

      const embedding = await embedText(contentForEmbedding);

      // Insert into documents table for RAG
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          source: 'product',
          source_id: product.id,
          content: contentForEmbedding,
          metadata: {
            product_id: product.id,
            title: body.title,
            price: body.price,
            currency: body.currency || 'EGP',
            tags: body.tags || []
          },
          embedding
        });

      if (docError) {
        console.warn('Failed to create document embedding:', docError.message);
      } else {
        embeddingCreated = true;
      }
    } catch (embErr) {
      console.warn('Embedding generation failed:', embErr instanceof Error ? embErr.message : embErr);
      // Product is still created, just without embedding
    }

    return NextResponse.json({ 
      success: true, 
      product,
      embeddingCreated,
      message: embeddingCreated 
        ? 'Product created with embedding for AI search' 
        : 'Product created (embedding generation failed - AI search may not find this product)'
    }, { status: 201 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('POST /api/products error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/products?id=xxx - Delete a product and its embedding
 */
export async function DELETE(req: Request) {
  try {
    const supabase = createSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }

    // Delete the document (embedding) first
    await supabase
      .from('documents')
      .delete()
      .eq('source', 'product')
      .eq('source_id', id);

    // Delete the product (cascades to variants and images)
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Product deleted' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('DELETE /api/products error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

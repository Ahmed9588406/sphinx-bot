import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.API_KEY;
    if (!url || !serviceKey) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    const supabase = createClient(url, serviceKey);
    const { data: order, error } = await supabase.from('orders').select('*').eq('id', id).single();
    if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // Only allow download for non-draft orders
    if (order.status === 'draft') {
      return NextResponse.json({ error: 'Order not available for download' }, { status: 403 });
    }

    const fileName = `order_${(order.metadata && order.metadata.order_number) ? order.metadata.order_number : order.id}.json`;
    const body = JSON.stringify(order, null, 2);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/api/orders/[id]/download error', message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

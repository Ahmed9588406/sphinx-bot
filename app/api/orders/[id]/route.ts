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

    const { data: order, error: orderErr } = await supabase.from('orders').select('*').eq('id', id).single();
    if (orderErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // fetch items
    const { data: items, error: itemsErr } = await supabase.from('order_items').select('*').eq('order_id', id);
    if (itemsErr) {
      console.warn('Could not fetch order items', itemsErr);
    }

    return NextResponse.json({ order, items: items || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/api/orders/[id] error', message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

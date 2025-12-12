import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

async function getUserFromToken(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.API_KEY;
  if (!url || !anonKey) return null;
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, confirm } = body;
    if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

    const user = await getUserFromToken(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.API_KEY;
    if (!url || !serviceKey) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    const supabase = createClient(url, serviceKey);

    const { data: existing, error: getErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (getErr || !existing) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (existing.user_id !== user.id) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    if (existing.status !== 'draft') return NextResponse.json({ error: 'Order is not draft' }, { status: 400 });

    // If confirm is truthy, finalize; otherwise cancel
    if (confirm) {
      const { data: updated, error: updateErr } = await supabase
        .from('orders')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select()
        .single();

      if (updateErr) {
        console.error('Error confirming order:', updateErr);
        return NextResponse.json({ error: 'Failed to confirm order' }, { status: 500 });
      }

      // Fetch order items with product details
      const { data: items } = await supabase
        .from('order_items')
        .select('*, products(id, title, description, price, currency)')
        .eq('order_id', orderId);

      return NextResponse.json({ order: updated, items: items || [] });
    } else {
      // cancel the draft
      const { data: deleted, error: delErr } = await supabase
        .from('orders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select()
        .single();

      if (delErr) {
        console.error('Error cancelling order:', delErr);
        return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 });
      }

      return NextResponse.json({ order: deleted });
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/api/orders/confirm error', message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

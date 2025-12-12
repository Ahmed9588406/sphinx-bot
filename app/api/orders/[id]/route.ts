import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Helper to get user from token
async function getUserFromToken(req: NextRequest) {
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

// PATCH - Update order shipping address
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // Verify user is authenticated
    const user = await getUserFromToken(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.API_KEY;
    if (!url || !serviceKey) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    const supabase = createClient(url, serviceKey);

    // Verify order exists and belongs to user
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Only allow updating draft orders
    if (order.status !== 'draft') {
      return NextResponse.json({ error: 'Cannot update confirmed order' }, { status: 400 });
    }

    // Parse request body
    const body = await req.json();
    const { shipping_address } = body;

    if (!shipping_address) {
      return NextResponse.json({ error: 'Missing shipping_address' }, { status: 400 });
    }

    // Update order with shipping address
    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update({
        shipping_address: {
          name: shipping_address.name || order.shipping_address?.name,
          phone: shipping_address.phone || order.shipping_address?.phone,
          address: shipping_address.address || order.shipping_address?.address
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      console.error('Failed to update order:', updateErr);
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    return NextResponse.json({ order: updatedOrder, success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/api/orders/[id] PATCH error', message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

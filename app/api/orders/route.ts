/* eslint-disable @typescript-eslint/no-explicit-any */
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
    const { items, shipping } = body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Missing items' }, { status: 400 });
    }

    const user = await getUserFromToken(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.API_KEY;
    if (!url || !serviceKey) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    const supabase = createClient(url, serviceKey);

    // Try to resolve product prices when product_id provided
    const itemsWithPrices = await Promise.all(items.map(async (it: any) => {
      if (it.product_id) {
        const { data: p } = await supabase.from('products').select('id,title,price').eq('id', it.product_id).single();
        return {
          product_id: p?.id || null,
          product_title: p?.title || it.product_title || null,
          quantity: Number(it.quantity || 1),
          unit_price: p?.price || Number(it.unit_price || 0)
        };
      }
      return {
        product_id: null,
        product_title: it.product_title || null,
        quantity: Number(it.quantity || 1),
        unit_price: Number(it.unit_price || 0)
      };
    }));

    const total = itemsWithPrices.reduce((s: number, it: any) => s + (Number(it.unit_price || 0) * Number(it.quantity || 1)), 0);

    const orderNumber = `SFX-${Date.now().toString(36)}-${Math.floor(Math.random() * 9000) + 1000}`;
    const orderRecord: any = {
      user_id: user.id,
      status: 'pending',
      total,
      currency: 'EGP',
      shipping_address: shipping || null,
      metadata: { created_via: 'api-orders', order_number: orderNumber }
    };

    const { data: orderData, error } = await supabase.from('orders').insert(orderRecord).select().single();
    if (error) {
      console.error('Order create error:', error);
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    // Insert order_items rows
    try {
      const orderItems = itemsWithPrices.map((it: any) => ({
        order_id: orderData.id,
        product_id: it.product_id,
        variant_id: null,
        quantity: it.quantity,
        price: it.unit_price || 0,
        metadata: {}
      }));
      await supabase.from('order_items').insert(orderItems);
    } catch (e) {
      // ignore if table doesn't exist
    }

    return NextResponse.json({ order: orderData });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('/api/orders error', errorMessage);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

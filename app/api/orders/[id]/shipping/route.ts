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

// PATCH - Update order shipping address
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing order id' }, { status: 400 });

    // Verify user is authenticated
    const user = await getUserFromToken(req);
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 });
    }

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.API_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const supabase = createClient(url, serviceKey);

    // Verify order exists and belongs to user
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    }

    // Only allow updating draft orders
    if (order.status !== 'draft') {
      return NextResponse.json({ error: 'لا يمكن تعديل طلب مؤكد' }, { status: 400 });
    }

    // Parse request body
    const body = await req.json();
    const { shipping_address } = body;

    if (!shipping_address) {
      return NextResponse.json({ error: 'بيانات الشحن مطلوبة' }, { status: 400 });
    }

    // Validate required fields
    if (!shipping_address.name?.trim()) {
      return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
    }
    if (!shipping_address.phone?.trim()) {
      return NextResponse.json({ error: 'رقم الهاتف مطلوب' }, { status: 400 });
    }
    if (!shipping_address.address?.trim()) {
      return NextResponse.json({ error: 'العنوان مطلوب' }, { status: 400 });
    }

    // Update order with shipping address
    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update({
        shipping_address: {
          name: shipping_address.name.trim(),
          phone: shipping_address.phone.trim(),
          address: shipping_address.address.trim()
        },
        metadata: {
          ...order.metadata,
          customer_name: shipping_address.name.trim()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      console.error('Failed to update shipping address:', updateErr);
      return NextResponse.json({ error: 'فشل في تحديث بيانات الشحن' }, { status: 500 });
    }

    return NextResponse.json({ 
      order: updatedOrder, 
      success: true,
      message: 'تم تحديث بيانات الشحن بنجاح'
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/api/orders/[id]/shipping PATCH error:', message);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

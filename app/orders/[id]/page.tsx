import React from 'react';
import { createSupabaseClient } from '../../../lib/agent';

type Props = { params: { id: string } };

export default async function OrderPage({ params }: Props) {
  const supabase = createSupabaseClient();
  if (!supabase) return <div>Supabase not configured</div>;

  const { data: order, error } = await supabase.from('orders').select('*').eq('id', params.id).single();
  if (error || !order) return <div>Order not found</div>;

  const { data: items } = await supabase.from('order_items').select('*').eq('order_id', params.id);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold">تفاصيل الطلب</h2>
      <p className="mt-2">رقم الطلب: {order.id}</p>
      <p>الحالة: {order.status}</p>
      <p>المجموع: {order.total} {order.currency}</p>
      <div className="mt-4">
        <h3 className="font-medium">العناصر</h3>
        {items && Array.isArray(items) ? (
          <ul className="list-disc pl-5">
            {items.map((it: any, idx: number) => (
              <li key={idx}>{it.title || it.product_title || it.product_id} x{it.quantity} — {it.price || 0} {order.currency}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {order.metadata?.shipping ? (
        <div className="mt-4">
          <h3 className="font-medium">تفاصيل الشحن</h3>
          <pre className="bg-gray-50 p-2 rounded">{JSON.stringify(order.metadata.shipping, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}

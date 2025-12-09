"use client";
import React from 'react';
import Link from 'next/link';

type Props = {
  order: any;
  receipt?: string;
};

export default function OrderReceipt({ order, receipt }: Props) {
  const [loadedOrder, setLoadedOrder] = React.useState<any>(order || null);
  React.useEffect(() => {
    if (order) setLoadedOrder(order);
  }, [order]);

  if (!loadedOrder && !receipt) return null;

  const displayOrder = loadedOrder;

  return (
    <div className="p-4 bg-white rounded shadow">
      <h3 className="text-lg font-semibold">فاتورة الطلب</h3>
      <p className="text-sm text-gray-600">رقم الطلب: {displayOrder?.id || '—'}</p>
      <div className="mt-2">
        {displayOrder?.items && Array.isArray(displayOrder.items) ? (
          <ul className="list-disc pl-5">
            {displayOrder.items.map((it: any, idx: number) => (
              <li key={idx}>
                {it.title || it.product_title || it.product_id} x{it.quantity} — {it.price || it.unit_price || 0} {displayOrder.currency || 'EGP'}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p className="mt-2 font-medium">المجموع: {displayOrder?.total || '—'} {displayOrder?.currency || 'EGP'}</p>
      {receipt ? (
        <pre className="mt-2 p-2 bg-gray-50 text-sm rounded">{receipt}</pre>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Link href={`/orders/${displayOrder?.id}`} className="px-3 py-1 bg-indigo-600 text-white rounded">عرض التفاصيل</Link>
        <a href={`/api/orders/${displayOrder?.id}/download`} className="px-3 py-1 bg-gray-600 text-white rounded" target="_blank" rel="noreferrer">تحميل التفاصيل</a>
      </div>
    </div>
  );
}

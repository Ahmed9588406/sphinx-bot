'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../app/context/AuthContext';
import ChatModal from '../../../app/components/ChatModal';

type ProductType = {
  id: string;
  title?: string;
  description?: string;
  price?: number;
  product_images?: Array<{ url: string }>;
};

export default function ProductDetailPage() {
  const params = useParams() as { id: string };
  const { id } = params || { id: '' };
  const { token, loading } = useAuth();
  const [product, setProduct] = useState<ProductType | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoadingProduct(true);
      try {
        const res = await fetch('/api/products', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error('Failed to load products');
        const data = await res.json();
        const found = (data.products || []).find((p: ProductType) => String(p.id) === String(id));
        setProduct(found || null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingProduct(false);
      }
    };

    if (id) fetchProduct();
  }, [id, token]);

  if (loading || loadingProduct) return <div className="p-6">Loading...</div>;

  if (!product) return <div className="p-6">المنتج غير موجود</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-start gap-6">
        <div className="w-1/2">
          {product.product_images && product.product_images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.product_images[0].url} alt={product.title} className="w-full h-[360px] object-cover rounded-lg" />
          ) : (
            <div className="w-full h-[360px] bg-slate-100 rounded-lg" />
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-2">{product.title}</h1>
          <p className="text-slate-600 mb-4">{product.description}</p>
          <div className="mb-4">{product.price ? `${product.price} EGP` : ''}</div>
          <div className="flex gap-3">
            <button onClick={() => setChatOpen(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg">اسأل عن المنتج</button>
          </div>
        </div>
      </div>

      <ChatModal open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

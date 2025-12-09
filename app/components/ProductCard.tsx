'use client';

import React from 'react';
import { useAuth } from '../context/AuthContext';

interface Product {
  id: string;
  title: string;
  description?: string;
  price?: number;
  image_url?: string;
}

export default function ProductCard({ product, onView }: { product: Product; onView?: (id: string) => void }) {
  const { isAuthenticated } = useAuth();

  const handleView = () => {
    // store recently seen in localStorage
    try {
      const key = 'sphinx_recent_products';
      const raw = localStorage.getItem(key);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      const filtered = [product.id, ...arr.filter(x => x !== product.id)].slice(0, 20);
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch (e) {
      // ignore
    }

    onView?.(product.id);
  };

  const imageSrc = (product as any).image_url || (product as any).product_images?.[0]?.url || null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt={product.title} className="w-full h-28 object-cover rounded-md mb-2" />
      ) : (
        <div className="w-full h-28 bg-slate-100 rounded-md mb-2 flex items-center justify-center text-slate-400">No image</div>
      )}
      <h3 className="font-semibold text-slate-800 mb-1 text-sm">{product.title}</h3>
      <p className="text-xs text-slate-500 mb-2 line-clamp-4">{product.description}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-emerald-600">{product.price ? `${product.price} EGP` : ''}</div>
        <div className="flex items-center gap-2">
          <button onClick={handleView} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg">عرض</button>
        </div>
      </div>
    </div>
  );
}

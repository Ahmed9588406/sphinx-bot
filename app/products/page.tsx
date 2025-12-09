'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../app/context/AuthContext';
import ProductCard from '../../app/components/ProductCard';
import Link from 'next/link';

type Product = { id: string; title: string; description?: string; price?: number; image_url?: string };

export default function ProductsPage() {
  const { isAuthenticated, loading, token } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/login');
  }, [loading, isAuthenticated, router]);

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      // Request a large limit so all products are returned. Adjust SEED_COUNT if your DB grows.
      const res = await fetch('/api/products?limit=1000', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Failed to load products');
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProducts(false);
    }
  }, [token]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleView = (id: string) => {
    // track recently seen in localStorage already done in ProductCard
    // optionally could call server to record view
    router.push(`/products/${id}`);
  };

  if (loading || (!isAuthenticated && !loading)) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">المنتجات</h1>
        <div className="flex items-center gap-2">
          <Link href="/chat" className="text-sm text-emerald-600">فتح الدردشة</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {loadingProducts ? (
          <div>Loading products...</div>
        ) : products.length === 0 ? (
          <div className="text-center col-span-full">لا توجد منتجات</div>
        ) : (
          products.map(p => (
            <div key={p.id} onClick={() => handleView(p.id)}>
              <ProductCard product={p} onView={handleView} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

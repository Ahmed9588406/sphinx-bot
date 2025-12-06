'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Package, Loader2, CheckCircle, XCircle, ArrowLeft, Search, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  tags: string[];
  created_at: string;
  product_variants?: Array<{
    id: string;
    sku: string;
    price: number;
    inventory_quantity: number;
  }>;
  product_images?: Array<{
    id: string;
    url: string;
    alt: string;
  }>;
}

interface FormData {
  title: string;
  description: string;
  price: string;
  currency: string;
  tags: string;
  variants: Array<{ sku: string; price: string; inventory: string }>;
  images: Array<{ url: string; alt: string }>;
}

const initialFormData: FormData = {
  title: '',
  description: '',
  price: '',
  currency: 'EGP',
  tags: '',
  variants: [{ sku: '', price: '', inventory: '0' }],
  images: [{ url: '', alt: '' }]
};

export default function ProductsAdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const payload = {
        title: formData.title,
        description: formData.description || undefined,
        price: formData.price ? parseFloat(formData.price) : undefined,
        currency: formData.currency,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        variants: formData.variants
          .filter(v => v.sku || v.price || v.inventory !== '0')
          .map(v => ({
            sku: v.sku || undefined,
            price: v.price ? parseFloat(v.price) : undefined,
            inventory_quantity: parseInt(v.inventory) || 0
          })),
        images: formData.images
          .filter(img => img.url)
          .map(img => ({ url: img.url, alt: img.alt || formData.title }))
      };

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create product');
      }

      setMessage({ 
        type: 'success', 
        text: data.embeddingCreated 
          ? '✅ تم إضافة المنتج بنجاح مع Embedding للبحث الذكي!'
          : '⚠️ تم إضافة المنتج لكن فشل إنشاء الـ Embedding'
      });
      setFormData(initialFormData);
      setShowForm(false);
      fetchProducts();

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`هل أنت متأكد من حذف "${title}"؟`)) return;

    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete');
      }

      setMessage({ type: 'success', text: 'تم حذف المنتج بنجاح' });
      fetchProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ';
      setMessage({ type: 'error', text: msg });
    }
  };

  const handleRegenerateEmbeddings = async () => {
    if (!confirm('سيتم إعادة إنشاء Embeddings لكل المنتجات. متأكد؟')) return;
    
    setRegenerating(true);
    setMessage(null);

    try {
      const res = await fetch('/api/products/regenerate-embeddings', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to regenerate');
      }

      setMessage({ 
        type: 'success', 
        text: `✅ تم تحديث ${data.successful} منتج بنجاح${data.failed > 0 ? ` (فشل ${data.failed})` : ''}`
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ';
      setMessage({ type: 'error', text: msg });
    } finally {
      setRegenerating(false);
    }
  };

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, { sku: '', price: '', inventory: '0' }]
    }));
  };

  const removeVariant = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const updateVariant = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) => i === index ? { ...v, [field]: value } : v)
    }));
  };

  const addImage = () => {
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, { url: '', alt: '' }]
    }));
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const updateImage = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.map((img, i) => i === index ? { ...img, [field]: value } : img)
    }));
  };

  const filteredProducts = products.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-500 hover:text-slate-700 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">إدارة المنتجات</h1>
                <p className="text-xs text-slate-500">إضافة وتعديل منتجات Sphinx Fit</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerateEmbeddings}
              disabled={regenerating}
              className="flex items-center gap-2 border border-slate-300 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all text-sm"
              title="إعادة إنشاء Embeddings لكل المنتجات"
            >
              <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? 'جاري التحديث...' : 'تحديث AI'}
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              إضافة منتج
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <p>{message.text}</p>
            <button onClick={() => setMessage(null)} className="ml-auto text-current opacity-50 hover:opacity-100">×</button>
          </div>
        )}

        {/* Add Product Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">إضافة منتج جديد</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    اسم المنتج <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                    placeholder="مثال: تيشيرت رياضي أسود"
                    dir="auto"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">السعر</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                      placeholder="299.00"
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-sm font-medium text-slate-700 mb-1">العملة</label>
                    <select
                      value={formData.currency}
                      onChange={e => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                    >
                      <option value="EGP">EGP</option>
                      <option value="USD">USD</option>
                      <option value="SAR">SAR</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الوصف</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  rows={3}
                  placeholder="وصف تفصيلي للمنتج... (مهم للبحث الذكي)"
                  dir="auto"
                />
                <p className="text-xs text-slate-500 mt-1">💡 الوصف الجيد يساعد الذكاء الاصطناعي على فهم المنتج وتقديمه للعملاء</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">التاجات (مفصولة بفاصلة)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={e => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  placeholder="رياضي, تيشيرت, جيم, أسود"
                  dir="auto"
                />
              </div>

              {/* Variants */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">المقاسات / الألوان (Variants)</label>
                  <button type="button" onClick={addVariant} className="text-sm text-emerald-600 hover:text-emerald-700">
                    + إضافة variant
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.variants.map((variant, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="SKU (مثال: TSH-BLK-M)"
                        value={variant.sku}
                        onChange={e => updateVariant(idx, 'sku', e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 outline-none"
                      />
                      <input
                        type="number"
                        placeholder="السعر"
                        value={variant.price}
                        onChange={e => updateVariant(idx, 'price', e.target.value)}
                        className="w-24 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 outline-none"
                      />
                      <input
                        type="number"
                        placeholder="الكمية"
                        value={variant.inventory}
                        onChange={e => updateVariant(idx, 'inventory', e.target.value)}
                        className="w-20 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 outline-none"
                      />
                      {formData.variants.length > 1 && (
                        <button type="button" onClick={() => removeVariant(idx)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Images */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">صور المنتج</label>
                  <button type="button" onClick={addImage} className="text-sm text-emerald-600 hover:text-emerald-700">
                    + إضافة صورة
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.images.map((img, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="url"
                        placeholder="رابط الصورة (URL)"
                        value={img.url}
                        onChange={e => updateImage(idx, 'url', e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="وصف الصورة (alt)"
                        value={img.alt}
                        onChange={e => updateImage(idx, 'alt', e.target.value)}
                        className="w-40 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 outline-none"
                        dir="auto"
                      />
                      {formData.images.length > 1 && (
                        <button type="button" onClick={() => removeImage(idx)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">🤖 كيف يعمل الـ Embedding؟</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• عند إضافة المنتج، يتم إنشاء embedding (تمثيل رقمي) من الاسم والوصف والتاجات</li>
                  <li>• هذا الـ embedding يُخزن في قاعدة البيانات Vector</li>
                  <li>• عندما يسأل عميل عن منتج، يتم مقارنة سؤاله مع الـ embeddings للعثور على المنتجات المناسبة</li>
                  <li>• الذكاء الاصطناعي يستخدم هذه المعلومات للرد على العميل بدقة</li>
                </ul>
              </div>

              {/* Submit */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-lg font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      جاري الإضافة...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      إضافة المنتج
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormData(initialFormData); }}
                  className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Products List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">المنتجات ({filteredProducts.length})</h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="بحث..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 outline-none w-64"
                dir="auto"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
              <p className="text-slate-500 mt-2">جاري التحميل...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-slate-500 mt-2">
                {searchQuery ? 'لا توجد منتجات مطابقة' : 'لا توجد منتجات بعد'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  إضافة أول منتج
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredProducts.map(product => (
                <div key={product.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-800 truncate">{product.title}</h3>
                      {product.description && (
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{product.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        {product.price && (
                          <span className="text-emerald-600 font-semibold">
                            {product.price} {product.currency}
                          </span>
                        )}
                        {product.tags && product.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {product.tags.slice(0, 3).map((tag, i) => (
                              <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                {tag}
                              </span>
                            ))}
                            {product.tags.length > 3 && (
                              <span className="text-xs text-slate-400">+{product.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(product.created_at).toLocaleDateString('ar-EG')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(product.id, product.title)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="حذف المنتج"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

"use client";
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Download, CheckCircle, Package, MapPin, Phone, Calendar, FileText } from 'lucide-react';

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  products: {
    title: string;
    description: string | null;
    product_images: { url: string | null }[] | null;
  } | null;
};

type Order = {
  id: string;
  created_at: string;
  status: string;
  total: number;
  currency: string;
  shipping_address: {
    name?: string;
    address?: string;
    phone?: string;
  } | null;
  metadata: {
    order_number?: string;
    customer_name?: string;
  } | null;
  order_items: OrderItem[];
};

type Props = {
  order: any;
  isDraft?: boolean; // For draft order preview styling
};

const OrderReceiptSkeleton = () => (
  <div className="border border-slate-200 rounded-lg p-4 w-full max-w-2xl mx-auto animate-pulse bg-white/80 backdrop-blur-sm">
    <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
    <div className="h-3 bg-slate-200 rounded w-1/2 mb-6"></div>
    <div className="space-y-3">
      <div className="h-3 bg-slate-200 rounded w-full"></div>
      <div className="h-3 bg-slate-200 rounded w-5/6"></div>
      <div className="h-3 bg-slate-200 rounded w-full"></div>
    </div>
    <div className="border-t border-slate-200 mt-6 pt-4 space-y-3">
      <div className="h-8 bg-slate-300 rounded w-full"></div>
    </div>
  </div>
);

export default function OrderReceipt({ order: initialOrder, isDraft = false }: Props) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const { token } = useAuth();
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialOrder?.id || !token) {
      // If initialOrder has order_items, use it directly (from chat response)
      if (initialOrder?.order_items) {
        setOrder(initialOrder);
        setLoading(false);
        return;
      }
      setLoading(false);
      setError('معلومات الطلب غير متوفرة أو أنك غير مسجل الدخول.');
      return;
    }

    const fetchOrderDetails = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/orders/${initialOrder.id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to fetch order details.');
        }

        const { order: orderData, items: orderItems } = await res.json();
        setOrder({ ...orderData, order_items: orderItems });
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [initialOrder, token]);

  const handlePrintPDF = async () => {
    if (!order?.id || downloadingPDF) return;

    setDownloadingPDF(true);
    try {
      // Try to use the PDF endpoint first
      if (token && isConfirmed) {
        try {
          const response = await fetch(`/api/orders/${order.id}/pdf`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `receipt-${order.metadata?.order_number || order.id}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            return;
          }
        } catch (e) {
          console.warn('PDF endpoint failed, falling back to print:', e);
        }
      }

      // Fallback: Use print functionality
      if (!receiptRef.current) return;

      const printContent = receiptRef.current.innerHTML;
      const printWindow = window.open('', '_blank', 'height=900,width=900');

      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html lang="ar" dir="rtl">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Order Receipt - ${order?.metadata?.order_number || order?.id}</title>
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
                * { margin: 0; padding: 0; }
                body { 
                  font-family: 'Cairo', sans-serif; 
                  direction: rtl;
                  background: #f5f5f5;
                }
                @page { size: A4; margin: 0; }
                @media print {
                  .no-print { display: none !important; }
                  body { margin: 0; padding: 0; }
                }
                .receipt { page-break-inside: avoid; }
              </style>
            </head>
            <body class="p-8">
              <div class="receipt">
                ${printContent}
              </div>
              <script>
                setTimeout(() => {
                  window.print();
                }, 500);
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (loading) {
    return <OrderReceiptSkeleton />;
  }

  if (error) {
    return <div className="text-red-500 text-sm p-4 bg-red-50 rounded-lg border border-red-200">{error}</div>;
  }

  if (!order) {
    return null;
  }

  const customerName = order.shipping_address?.name || order.metadata?.customer_name || 'العميل';
  const orderNumber = order.metadata?.order_number || order.id;
  const isConfirmed = order.status === 'confirmed';
  const isOrderDraft = isDraft || order.status === 'draft';

  return (
    <div className="w-full max-w-2xl mx-auto my-2">
      {/* Receipt Container */}
      <div ref={receiptRef} className="bg-gradient-to-b from-slate-50 to-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
        {/* Header with Status Badge */}
        <div className={`px-6 py-8 text-white relative overflow-hidden ${
          isOrderDraft 
            ? 'bg-gradient-to-r from-amber-500 to-orange-500' 
            : 'bg-gradient-to-r from-emerald-600 to-teal-600'
        }`}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16"></div>
          
          <div className="relative flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold">Sphinx Fit</h2>
              <p className={`text-sm mt-1 ${isOrderDraft ? 'text-amber-100' : 'text-emerald-100'}`}>
                {isOrderDraft ? '📋 مراجعة الطلب قبل التأكيد' : '✓ متجر الملابس الرياضية الموثوق'}
              </p>
            </div>
            {isConfirmed && (
              <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-white" />
                <span className="font-semibold text-sm">طلب مؤكد</span>
              </div>
            )}
            {isOrderDraft && (
              <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2">
                <FileText className="w-5 h-5 text-white" />
                <span className="font-semibold text-sm">مسودة طلب</span>
              </div>
            )}
          </div>

          <div className="relative grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className={`text-xs uppercase tracking-wide mb-1 ${isOrderDraft ? 'text-amber-100' : 'text-emerald-100'}`}>رقم الطلب</p>
              <p className="font-mono text-lg font-bold">{orderNumber}</p>
            </div>
            <div className="text-left">
              <p className={`text-xs uppercase tracking-wide mb-1 ${isOrderDraft ? 'text-amber-100' : 'text-emerald-100'}`}>تاريخ الطلب</p>
              <p className="font-semibold">{new Date(order.created_at).toLocaleDateString('ar-EG', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="px-6 py-6 border-b border-slate-200 grid grid-cols-2 gap-6">
          <div className="flex items-start gap-3">
            <div className="bg-emerald-100 p-2.5 rounded-lg">
              <Package className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-slate-600 text-xs uppercase tracking-wide font-semibold">العميل</p>
              <p className="text-slate-900 font-semibold text-sm mt-1">{customerName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-blue-100 p-2.5 rounded-lg">
              <Phone className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-slate-600 text-xs uppercase tracking-wide font-semibold">الهاتف</p>
              <p className="text-slate-900 font-semibold text-sm mt-1 direction-ltr">
                {order.shipping_address?.phone || <span className="text-slate-400 italic">لم يتم تحديده</span>}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 col-span-2">
            <div className="bg-purple-100 p-2.5 rounded-lg">
              <MapPin className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-slate-600 text-xs uppercase tracking-wide font-semibold">عنوان التوصيل</p>
              <p className="text-slate-900 font-semibold text-sm mt-1">
                {order.shipping_address?.address || <span className="text-slate-400 italic">لم يتم تحديده - سيتم التواصل معك لتحديد العنوان</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="px-6 py-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide mb-4">تفاصيل الطلب</h3>
          
          <div className="space-y-3">
            {order.order_items.map((item, idx) => (
              <div key={item.id} className="flex items-start justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm">
                    {idx + 1}. {item.products?.title || 'منتج'}
                  </p>
                  {item.products?.description && (
                    <p className="text-slate-600 text-xs mt-1 line-clamp-1">{item.products.description}</p>
                  )}
                  <p className="text-slate-500 text-xs mt-1">
                    سعر الوحدة: {item.price.toFixed(0)} {order.currency}
                  </p>
                </div>
                <div className="text-left ml-4 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full font-semibold">الكمية: {item.quantity}</span>
                  </div>
                  <p className="font-mono font-bold text-emerald-600">
                    {(item.price * item.quantity).toFixed(0)} <span className="text-xs text-slate-600">{order.currency}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="px-6 py-6 bg-gradient-to-r from-slate-50 to-slate-100 border-t border-slate-200">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm text-slate-600">
              <span>الكمية الإجمالية:</span>
              <span className="font-semibold">{order.order_items.reduce((sum, item) => sum + item.quantity, 0)} عنصر</span>
            </div>
            <div className="h-px bg-slate-200"></div>
            <div className="flex justify-between items-center text-lg">
              <span className="font-bold text-slate-900">المجموع النهائي:</span>
              <span className="font-mono font-bold text-emerald-600">
                {order.total.toFixed(2)} <span className="text-sm text-slate-600">{order.currency}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-900 text-white text-center text-xs space-y-2">
          <p>شكراً لتعاملك مع Sphinx Fit 💪</p>
          <p className="text-slate-400">تتبع طلبك عبر رقم الطلب أعلاه</p>
        </div>
      </div>

      {/* Action Buttons */}
      {isConfirmed && (
        <div className="mt-4 flex gap-3 no-print">
          <button
            onClick={handlePrintPDF}
            disabled={downloadingPDF}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200 font-semibold"
          >
            <Download className="w-5 h-5" />
            {downloadingPDF ? 'جاري التحميل...' : 'تحميل الفاتورة (PDF)'}
          </button>
          <button
            onClick={handlePrintPDF}
            disabled={downloadingPDF}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-lg hover:border-emerald-600 hover:text-emerald-600 hover:bg-emerald-50 transition-all duration-200 font-semibold"
          >
            <FileText className="w-5 h-5" />
            طباعة الفاتورة
          </button>
        </div>
      )}
    </div>
  );
}

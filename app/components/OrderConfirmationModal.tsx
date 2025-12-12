'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Phone, User, CheckCircle, Loader2, ShoppingBag } from 'lucide-react';

interface ShippingInfo {
  name: string;
  phone: string;
  address: string;
}

interface OrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (shippingInfo: ShippingInfo) => void;
  loading?: boolean;
  orderSummary?: {
    items: Array<{ title: string; quantity: number; price: number }>;
    total: number;
    currency: string;
  };
}

export default function OrderConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  orderSummary
}: OrderConfirmationModalProps) {
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    name: '',
    phone: '',
    address: ''
  });
  const [errors, setErrors] = useState<Partial<ShippingInfo>>({});
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Reset form and focus when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset form fields when modal opens
      setShippingInfo({ name: '', phone: '', address: '' });
      setErrors({});
      // Focus on name input when modal opens
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Partial<ShippingInfo> = {};
    
    if (!shippingInfo.name.trim()) {
      newErrors.name = 'الاسم مطلوب';
    }
    
    if (!shippingInfo.phone.trim()) {
      newErrors.phone = 'رقم الهاتف مطلوب';
    } else if (!/^(01[0-2,5]\d{8}|(\+20)?1[0-2,5]\d{8})$/.test(shippingInfo.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'رقم هاتف غير صحيح';
    }
    
    if (!shippingInfo.address.trim()) {
      newErrors.address = 'العنوان مطلوب';
    } else if (shippingInfo.address.trim().length < 10) {
      newErrors.address = 'العنوان قصير جداً';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onConfirm(shippingInfo);
    }
  };

  const handleInputChange = (field: keyof ShippingInfo, value: string) => {
    setShippingInfo(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm p-2 rounded-full">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">بيانات التوصيل</h2>
              <p className="text-emerald-100 text-xs">أدخل بياناتك لإتمام الطلب</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Order Summary */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-700">ملخص الطلب</h3>
          </div>
          {orderSummary && orderSummary.items.length > 0 ? (
            <div className="space-y-2 text-sm">
              {orderSummary.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-slate-600 bg-white px-3 py-2 rounded-lg">
                  <span className="font-medium">{item.title} × {item.quantity}</span>
                  <span className="text-emerald-600 font-semibold">{(item.price * item.quantity).toFixed(0)} {orderSummary.currency}</span>
                </div>
              ))}
              <div className="border-t border-slate-200 pt-3 mt-3 flex justify-between font-bold text-slate-800 bg-emerald-50 px-3 py-2 rounded-lg">
                <span>المجموع الكلي</span>
                <span className="text-emerald-600 text-lg">{orderSummary.total.toFixed(0)} {orderSummary.currency}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-3 text-slate-500 text-sm">
              <p>سيتم عرض تفاصيل الطلب هنا</p>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[50vh]">
          {/* Name Field */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
              <User className="w-4 h-4 text-slate-500" />
              الاسم الكامل
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={shippingInfo.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'
              } focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm`}
              placeholder="أدخل اسمك الكامل"
              dir="auto"
              disabled={loading}
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          {/* Phone Field */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
              <Phone className="w-4 h-4 text-slate-500" />
              رقم الهاتف
            </label>
            <input
              type="tel"
              value={shippingInfo.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border ${
                errors.phone ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'
              } focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm`}
              placeholder="01xxxxxxxxx"
              dir="ltr"
              disabled={loading}
            />
            {errors.phone && (
              <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
            )}
          </div>

          {/* Address Field */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
              <MapPin className="w-4 h-4 text-slate-500" />
              عنوان التوصيل
            </label>
            <textarea
              value={shippingInfo.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border ${
                errors.address ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'
              } focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm resize-none`}
              placeholder="المحافظة، المدينة، الشارع، رقم المبنى..."
              rows={3}
              dir="auto"
              disabled={loading}
            />
            {errors.address && (
              <p className="text-red-500 text-xs mt-1">{errors.address}</p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border-2 border-slate-200 text-slate-700 rounded-xl hover:bg-slate-100 transition-colors font-medium text-sm disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:shadow-lg transition-all font-medium text-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري التأكيد...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                تأكيد الطلب
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

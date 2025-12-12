/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useCallback, useEffect } from 'react';
import { MessageCircle, User, RefreshCw, Sparkles, AlertCircle, Send, CheckCircle, XCircle, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import OrderReceipt from './OrderReceipt';
import OrderConfirmationModal from './OrderConfirmationModal';

type Message = { 
  role: "user" | "assistant"; 
  content: string;
  order?: any;
  draftOrder?: any;
};

interface ShippingInfo {
  name: string;
  phone: string;
  address: string;
}

interface ChatWidgetProps {
  conversationId?: string | null;
  onConversationChange?: (conversationId: string | null) => void;
  onMessageSent?: () => void;
}

export default function ChatWidget({ 
  conversationId: externalConversationId, 
  onConversationChange,
  onMessageSent 
}: ChatWidgetProps) {
  const { user, isAuthenticated, loading: authLoading, token } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalConversationId, setInternalConversationId] = useState<string | null>(null);
  const [greeted, setGreeted] = useState(false);
  const [nextPagingOffset, setNextPagingOffset] = useState<number | null>(null);
  
  // Modal state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [pendingDraftOrder, setPendingDraftOrder] = useState<any>(null);
  const [confirmingOrder, setConfirmingOrder] = useState(false);
  const [lastDraftOrderId, setLastDraftOrderId] = useState<string | null>(null);
  const [confirmedOrderIds, setConfirmedOrderIds] = useState<Set<string>>(new Set());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const _currentConversationId = externalConversationId !== undefined ? externalConversationId : internalConversationId;
  void _currentConversationId;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const loadConversation = useCallback(async (convId: string) => {
    if (!token) return;
    
    setLoadingConversation(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/conversations/${convId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to load conversation');
      }

      const data = await res.json();
      
      const loadedMessages: Message[] = (data.messages || []).map((m: any) => ({
        role: m.sender as 'user' | 'assistant',
        content: m.content
      }));

      setMessages(loadedMessages);
      setInternalConversationId(convId);
      setGreeted(true);
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
      setError('فشل في تحميل المحادثة');
    } finally {
      setLoadingConversation(false);
    }
  }, [token]);

  useEffect(() => {
    if (externalConversationId && token) {
      loadConversation(externalConversationId);
    } else if (externalConversationId === null) {
      setMessages([]);
      setInternalConversationId(null);
      setGreeted(false);
      setError(null);
      setPendingDraftOrder(null);
      setLastDraftOrderId(null);
      setShowOrderModal(false);
      setConfirmedOrderIds(new Set());
    }
  }, [externalConversationId, token, loadConversation]);

  useEffect(() => {
    if (isAuthenticated && user && !greeted && !authLoading && !externalConversationId && messages.length === 0) {
      const userName = user.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Friend';
      const isArabic = /[\u0600-\u06FF]/.test(userName);
      
      const greeting: Message = {
        role: 'assistant',
        content: isArabic 
          ? `أهلاً ${userName}! 👋 أنا مساعدك الذكي في Sphinx Fit. كيف أقدر أساعدك النهارده؟`
          : `Hi ${userName}! 👋 I'm your Sphinx Fit assistant. How can I help you today?`
      };
      
      setMessages([greeting]);
      setGreeted(true);
    }
  }, [isAuthenticated, user, greeted, authLoading, externalConversationId, messages.length]);

  const sendMessage = async (customMessage?: string) => {
    const messageToSend = customMessage || input.trim();
    if (!messageToSend || loading) return;
    
    setError(null);
    const userMsg: Message = { role: "user", content: messageToSend };
    setMessages(prev => [...prev, userMsg]);
    if (!customMessage) setInput("");
    setLoading(true);

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          message: messageToSend,
          conversationHistory,
          userId: user?.id,
          userName: user?.name || user?.user_metadata?.name || user?.email?.split('@')[0]
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || `Error: ${res.status}`);
      }
      
      const assistantMsg: Message = { 
        role: 'assistant', 
        content: data.reply || 'لم أتمكن من الرد، جرب مرة تانية',
        order: data.confirmedOrder || undefined,
        draftOrder: data.draftOrder || undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
      
      // If there's a draft order, store it and AUTOMATICALLY show the modal
      if (data.draftOrder) {
        setPendingDraftOrder(data.draftOrder);
        setLastDraftOrderId(data.draftOrder.id);
        // Automatically open the modal when draft order is created
        setShowOrderModal(true);
      } else if (data.confirmedOrder) {
        // Clear draft order when order is confirmed
        setPendingDraftOrder(null);
        setLastDraftOrderId(null);
      }
      
      setNextPagingOffset(data.paging?.nextOffset ?? null);
      
      if (data.conversationId) {
        setInternalConversationId(data.conversationId);
        onConversationChange?.(data.conversationId);
        onMessageSent?.();
      }
      
    } catch (err: any) {
      const errorMessage = err.message || 'حصل خطأ في الاتصال';
      setError(errorMessage);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `⚠️ ${errorMessage}` 
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // Handle order confirmation with shipping info from modal
  const handleOrderConfirm = async (shippingInfo: ShippingInfo) => {
    setConfirmingOrder(true);
    setError(null);
    
    const orderId = pendingDraftOrder?.id || lastDraftOrderId;
    if (!orderId) {
      setError('لم يتم العثور على الطلب');
      setConfirmingOrder(false);
      return;
    }
    
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Step 1: Update shipping info
      const shippingRes = await fetch(`/api/orders/${orderId}/shipping`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ shipping_address: shippingInfo })
      });
      
      if (!shippingRes.ok) {
        const shippingData = await shippingRes.json();
        throw new Error(shippingData.error || 'فشل في حفظ بيانات الشحن');
      }

      // Step 2: Confirm the order directly via API (not through chat)
      const confirmRes = await fetch(`/api/orders/confirm`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderId, confirm: true })
      });
      
      const confirmData = await confirmRes.json();
      
      if (!confirmRes.ok) {
        throw new Error(confirmData.error || 'فشل في تأكيد الطلب');
      }
      
      // Close modal FIRST
      setShowOrderModal(false);
      
      // Clear draft order state and mark as confirmed
      setPendingDraftOrder(null);
      setLastDraftOrderId(null);
      setConfirmedOrderIds(prev => new Set([...prev, orderId]));
      
      // Add confirmation messages to chat with the confirmed order
      const confirmMsg: Message = { 
        role: "user", 
        content: `✅ تأكيد الطلب\n👤 الاسم: ${shippingInfo.name}\n📍 العنوان: ${shippingInfo.address}\n📞 الهاتف: ${shippingInfo.phone}` 
      };
      
      const confirmedOrder = confirmData.order;
      const orderNumber = confirmedOrder?.metadata?.order_number || confirmedOrder?.id || orderId;
      
      // Build the confirmed order object with all necessary data
      const orderWithItems = {
        ...confirmedOrder,
        order_items: (confirmData.items || pendingDraftOrder?.order_items || []).map((item: any) => ({
          ...item,
          products: item.products || {
            title: item.product_title || 'منتج',
            description: null,
            price: item.price,
            currency: 'EGP'
          }
        })),
        shipping_address: {
          name: shippingInfo.name,
          phone: shippingInfo.phone,
          address: shippingInfo.address
        }
      };
      
      const assistantMsg: Message = { 
        role: 'assistant', 
        content: `🎉 تم تأكيد طلبك بنجاح!\n\n📦 رقم الطلب: ${orderNumber}\n💰 المجموع: ${confirmedOrder?.total || pendingDraftOrder?.total || 0} EGP\n\nشكراً لتعاملك مع Sphinx Fit! هنتواصل معاك قريب لتأكيد تفاصيل الشحن.`,
        order: orderWithItems
      };
      
      setMessages(prev => [...prev, confirmMsg, assistantMsg]);
      onMessageSent?.();
      
    } catch (err: any) {
      setError(err.message || 'حصل خطأ في تأكيد الطلب');
      setShowOrderModal(false);
    } finally {
      setConfirmingOrder(false);
    }
  };

  // Handle order cancellation
  const handleOrderCancel = async () => {
    setLoading(true);
    
    try {
      await sendMessage('لا، إلغاء الطلب');
      setPendingDraftOrder(null);
      setLastDraftOrderId(null);
    } finally {
      setLoading(false);
    }
  };

  // Open modal for order confirmation
  const handleOpenOrderModal = () => {
    setShowOrderModal(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    setInternalConversationId(null);
    onConversationChange?.(null);
    setGreeted(false);
    setNextPagingOffset(null);
    setPendingDraftOrder(null);
    setLastDraftOrderId(null);
    setShowOrderModal(false);
    setConfirmedOrderIds(new Set());
    inputRef.current?.focus();
  };

  const requestMore = async (offset: number) => {
    if (loading) return;
    setError(null);
    setLoading(true);

    const userMsg: Message = { role: 'user', content: 'عرض المزيد' };
    setMessages(prev => [...prev, userMsg]);

    try {
      const conversationHistory = messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          message: 'عرض المزيد',
          conversationHistory,
          offset,
          userId: user?.id,
          userName: user?.name || user?.user_metadata?.name || user?.email?.split('@')[0]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error: ${res.status}`);

      const assistantMsg: Message = { role: 'assistant', content: data.reply || 'لم أتمكن من الرد' };
      setMessages(prev => [...prev, assistantMsg]);
      setNextPagingOffset(data.paging?.nextOffset ?? null);

      if (data.conversationId) {
        setInternalConversationId(data.conversationId);
        onConversationChange?.(data.conversationId);
        onMessageSent?.();
      }
    } catch (err: any) {
      const errorMessage = err.message || 'حصل خطأ في الاتصال';
      setError(errorMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${errorMessage}` }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // Prepare order summary for modal
  const getOrderSummary = () => {
    if (!pendingDraftOrder?.order_items) return undefined;
    
    return {
      items: pendingDraftOrder.order_items.map((item: any) => ({
        title: item.products?.title || 'منتج',
        quantity: item.quantity,
        price: item.price
      })),
      total: pendingDraftOrder.total || 0,
      currency: pendingDraftOrder.currency || 'EGP'
    };
  };

  // Download PDF receipt for confirmed order
  const downloadReceipt = async (orderId: string) => {
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(`/api/orders/${orderId}/pdf`, {
        headers
      });
      
      if (!res.ok) {
        throw new Error('فشل في تحميل الفاتورة');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sphinx-fit-order-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'فشل في تحميل الفاتورة');
    }
  };

  if (authLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-500">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-2xl mx-auto">
        <div className="rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm p-2 rounded-full">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-base">Sphinx Fit Support</h2>
                <p className="text-emerald-100 text-xs">
                  {user 
                    ? `مرحباً ${user.name || user.user_metadata?.name || user.email?.split('@')[0]} • Online`
                    : 'مساعدك الذكي • Online'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-full" title={user.email}>
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="flex items-center gap-1.5 text-white/90 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors text-xs font-medium"
                  title="محادثة جديدة"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>محادثة جديدة</span>
                </button>
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className="h-[400px] overflow-y-auto p-4 space-y-4 bg-slate-50">
            {loadingConversation ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-4">
                <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
                <p className="text-slate-500">جاري تحميل المحادثة...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-4">
                <div className="bg-gradient-to-br from-emerald-100 to-teal-100 p-4 rounded-full">
                  <Sparkles className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <p className="text-slate-700 font-medium mb-2">أهلاً بيك في Sphinx Fit! 💪</p>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    أنا هنا أساعدك في أي سؤال عن الطلبات، المنتجات، أو المقاسات.
                    <br />اكتب سؤالك وأنا هرد عليك فوراً!
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {['إيه المنتجات المتاحة؟', 'فين طلبي؟', 'إيه سياسة الإرجاع؟'].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); inputRef.current?.focus(); }}
                      className="text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            
            {messages.map((m, i) => (
              <div 
                key={i} 
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    m.role === 'user' 
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white' 
                      : 'bg-white text-slate-800 border border-slate-200 shadow-sm'
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" dir="auto">{m.content}</p>
                  </div>
                </div>
                {/* Draft Order Display - Only show if not already confirmed */}
                {m.draftOrder && m.role === 'assistant' && !confirmedOrderIds.has(m.draftOrder.id) && (
                  <div className="mt-4 w-full">
                    <OrderReceipt order={m.draftOrder} isDraft={true} />
                    <div className="flex gap-3 mt-3 justify-center">
                      <button
                        onClick={() => {
                          setPendingDraftOrder(m.draftOrder);
                          setLastDraftOrderId(m.draftOrder.id);
                          setShowOrderModal(true);
                        }}
                        disabled={loading || confirmingOrder}
                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200 font-semibold text-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        إكمال الطلب
                      </button>
                      <button
                        onClick={handleOrderCancel}
                        disabled={loading || confirmingOrder}
                        className="flex items-center gap-2 px-6 py-2.5 bg-white border-2 border-red-200 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold text-sm"
                      >
                        <XCircle className="w-4 h-4" />
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
                {/* Confirmed Order Receipt Display with Download Button */}
                {m.order && m.role === 'assistant' && (
                  <div className="mt-4 w-full">
                    <OrderReceipt order={m.order} />
                    <div className="flex justify-center mt-3">
                      <button
                        onClick={() => downloadReceipt(m.order.id)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 font-semibold text-sm"
                      >
                        <Download className="w-4 h-4" />
                        تحميل الفاتورة PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 shadow-sm">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Show More Button */}
            {nextPagingOffset !== null && !loading && (
              <div className="flex justify-center">
                <button
                  onClick={() => requestMore(nextPagingOffset)}
                  className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-full hover:bg-emerald-100 transition-colors"
                >
                  عرض المزيد
                </button>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-red-50 border-t border-red-200 px-4 py-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-red-600 text-xs">{error}</p>
            </div>
          )}

          {/* Input Area */}
          <div className="bg-white border-t border-slate-200 p-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
                style={{ minHeight: '44px', maxHeight: '120px' }}
                rows={1}
                placeholder="اكتب رسالتك هنا..."
                disabled={loading}
                dir="auto"
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 p-3 text-white shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 text-center">
              Enter للإرسال • Shift+Enter لسطر جديد
            </p>
          </div>
        </div>
      </div>

      {/* Order Confirmation Modal */}
      <OrderConfirmationModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        onConfirm={handleOrderConfirm}
        loading={confirmingOrder}
        orderSummary={getOrderSummary()}
      />
    </>
  );
}

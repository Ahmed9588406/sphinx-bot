'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback } from "react";
import { Send, MessageCircle, Sparkles, RefreshCw, AlertCircle, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";

type Message = { role: "user" | "assistant"; content: string };

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Track current conversation ID for display purposes
  const _currentConversationId = externalConversationId !== undefined ? externalConversationId : internalConversationId;
  void _currentConversationId; // silence unused warning - kept for future use

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Load conversation from API
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
      
      // Convert messages from DB format to chat format
      const loadedMessages: Message[] = (data.messages || []).map((m: any) => ({
        role: m.sender as 'user' | 'assistant',
        content: m.content
      }));

      setMessages(loadedMessages);
      setInternalConversationId(convId);
      setGreeted(true); // Don't show greeting for loaded conversations
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
      setError('فشل في تحميل المحادثة');
    } finally {
      setLoadingConversation(false);
    }
  }, [token]);

  // Load conversation messages when external conversation ID changes
  useEffect(() => {
    if (externalConversationId && token) {
      loadConversation(externalConversationId);
    } else if (externalConversationId === null) {
      // New conversation requested - clear messages
      setMessages([]);
      setInternalConversationId(null);
      setGreeted(false);
      setError(null);
    }
  }, [externalConversationId, token, loadConversation]);

  // Personalized greeting when user is authenticated and no conversation loaded
  useEffect(() => {
    if (isAuthenticated && user && !greeted && !authLoading && !externalConversationId && messages.length === 0) {
      const userName = user.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Friend';
      // Detect if user's name has Arabic characters
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

  const sendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || loading) return;
    
    setError(null);
    const userMsg: Message = { role: "user", content: trimmedInput };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Build conversation history for context
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
          message: trimmedInput,
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
        content: data.reply || 'لم أتمكن من الرد، جرب مرة تانية' 
      };
      setMessages(prev => [...prev, assistantMsg]);
      // If server returned paging info, keep next offset for 'show more'
      setNextPagingOffset(data.paging?.nextOffset ?? null);
      
      // Store conversation ID returned from API
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
    inputRef.current?.focus();
  };

  // Request more products using paging offset returned from server
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

  // Show loading while checking auth
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
                className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                title="مسح المحادثة"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="h-[400px] overflow-y-auto p-4 space-y-3 bg-slate-50">
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
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                m.role === 'user' 
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white' 
                  : 'bg-white text-slate-800 border border-slate-200 shadow-sm'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" dir="auto">{m.content}</p>
              </div>
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
              onClick={sendMessage}
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
  );
}
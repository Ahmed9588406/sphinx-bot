'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Plus, Clock, ChevronLeft, ChevronRight, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Conversation {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  last_message?: string;
}

interface ConversationSidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  onNewConversation: () => void;
  refreshTrigger?: number;
}

export default function ConversationSidebar({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  refreshTrigger
}: ConversationSidebarProps) {
  const { token, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!token || !isAuthenticated) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (refreshTrigger) {
      fetchConversations();
    }
  }, [refreshTrigger, fetchConversations]);

  const deleteConversation = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (!token || deletingId) return;

    if (!confirm('هل تريد حذف هذه المحادثة؟')) return;

    setDeletingId(conversationId);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== conversationId));
        if (currentConversationId === conversationId) {
          onSelectConversation(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays < 7) return `منذ ${diffDays} يوم`;
    
    return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
  };

  const getConversationTitle = (conv: Conversation) => {
    if (conv.title && conv.title !== 'محادثة دعم') {
      return conv.title;
    }
    const date = new Date(conv.created_at);
    return `محادثة ${date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}`;
  };

  if (!isAuthenticated) return null;

  return (
    <div 
      className={`bg-white border-l border-slate-200 h-full flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-14' : 'w-72'
      }`}
    >
      {/* Header */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
        {!isCollapsed && (
          <h3 className="font-semibold text-slate-700 text-sm">المحادثات</h3>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-500"
          title={isCollapsed ? 'توسيع' : 'طي'}
        >
          {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* New Conversation Button */}
      <div className={`p-3 border-b border-slate-100 ${isCollapsed ? 'px-2' : ''}`}>
        <button
          onClick={onNewConversation}
          className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all text-sm font-medium ${
            isCollapsed ? 'p-2.5' : 'px-4 py-2.5'
          }`}
          title="محادثة جديدة"
        >
          <Plus className="w-4 h-4" />
          {!isCollapsed && <span>محادثة جديدة</span>}
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          !isCollapsed && (
            <div className="text-center py-8 px-4">
              <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500 font-medium">لا توجد محادثات</p>
              <p className="text-xs text-slate-400 mt-1">ابدأ محادثة جديدة!</p>
            </div>
          )
        ) : (
          <div className="py-2 space-y-1">
            {conversations.map((conv, index) => (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelectConversation(conv.id)}
                className={`w-full text-right transition-all cursor-pointer group ${
                  currentConversationId === conv.id
                    ? 'bg-emerald-50 border-r-[3px] border-emerald-500'
                    : 'hover:bg-slate-50 border-r-[3px] border-transparent'
                } ${isCollapsed ? 'p-2' : 'px-3 py-2.5'}`}
              >
                {isCollapsed ? (
                  <div 
                    className={`w-9 h-9 rounded-lg flex items-center justify-center mx-auto relative ${
                      currentConversationId === conv.id 
                        ? 'bg-emerald-100 text-emerald-600' 
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                    }`}
                    title={getConversationTitle(conv)}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
                      {index + 1}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 relative ${
                      currentConversationId === conv.id 
                        ? 'bg-emerald-100 text-emerald-600' 
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                    }`}>
                      <MessageSquare className="w-4 h-4" />
                      <span className={`absolute -top-1 -right-1 w-4 h-4 text-white text-[10px] rounded-full flex items-center justify-center font-medium ${
                        currentConversationId === conv.id ? 'bg-emerald-600' : 'bg-slate-400'
                      }`}>
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${
                        currentConversationId === conv.id 
                          ? 'text-emerald-700 font-semibold' 
                          : 'text-slate-700 font-medium'
                      }`}>
                        {getConversationTitle(conv)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-400">
                          {formatDate(conv.last_message_at || conv.updated_at)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => deleteConversation(e, conv.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="حذف المحادثة"
                      disabled={deletingId === conv.id}
                    >
                      {deletingId === conv.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with count */}
      {!isCollapsed && conversations.length > 0 && (
        <div className="p-3 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <p className="text-xs text-slate-400 text-center">
            {conversations.length} محادثة
          </p>
        </div>
      )}
    </div>
  );
}

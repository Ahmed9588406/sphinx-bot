'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../app/context/AuthContext';
import ConversationSidebar from '../../app/components/ConversationSidebar';
import ChatWidget from '../../app/components/ChatWidget';
import { MessageSquare, Plus, Menu, X } from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export default function ChatPage() {
  const { isAuthenticated, loading, token } = useAuth();
  const router = useRouter();
  
  // State for managing conversations
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/login');
  }, [loading, isAuthenticated, router]);

  // Fetch conversations for mobile tabs
  const fetchConversations = useCallback(async () => {
    if (!token || !isAuthenticated) return;
    
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
    }
  }, [token, isAuthenticated]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations, refreshTrigger]);

  // Handle selecting a conversation from sidebar
  const handleSelectConversation = useCallback((conversationId: string | null) => {
    setCurrentConversationId(conversationId);
    setMobileMenuOpen(false);
  }, []);

  // Handle starting a new conversation
  const handleNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMobileMenuOpen(false);
  }, []);

  // Handle when a message is sent (to refresh sidebar)
  const handleMessageSent = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Handle conversation change from ChatWidget - this creates a new tab when a new conversation starts
  const handleConversationChange = useCallback((conversationId: string | null) => {
    if (conversationId && conversationId !== currentConversationId) {
      // New conversation created - update the current tab to this conversation
      setCurrentConversationId(conversationId);
      // Refresh to show the new conversation in the sidebar/tabs
      setRefreshTrigger(prev => prev + 1);
    }
  }, [currentConversationId]);

  const getConversationTitle = (conv: Conversation) => {
    if (conv.title && conv.title !== 'محادثة دعم') {
      return conv.title.length > 15 ? conv.title.slice(0, 15) + '...' : conv.title;
    }
    const date = new Date(conv.created_at);
    return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <p className="text-slate-600">جاري التحويل لصفحة تسجيل الدخول...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="flex h-screen">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <ConversationSidebar 
            currentConversationId={currentConversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            refreshTrigger={refreshTrigger}
          />
        </div>
        
        {/* Main chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile Header with Tabs */}
          <div className="lg:hidden bg-white border-b border-slate-200 shadow-sm">
            {/* Top bar with menu toggle */}
            <div className="flex items-center justify-between px-4 py-3">
              <h1 className="font-semibold text-slate-800">المحادثات</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleNewConversation}
                  className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                  title="محادثة جديدة"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            {/* Horizontal scrollable tabs */}
            <div className="flex overflow-x-auto px-2 pb-2 gap-2 scrollbar-hide">
              {/* New Chat Tab */}
              <button
                onClick={handleNewConversation}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  currentConversationId === null
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                جديدة
              </button>
              
              {/* Conversation Tabs */}
              {conversations.slice(0, 10).map((conv, index) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    currentConversationId === conv.id
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    currentConversationId === conv.id ? 'bg-white/20' : 'bg-slate-300 text-white'
                  }`}>
                    {index + 1}
                  </span>
                  {getConversationTitle(conv)}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Dropdown Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden absolute top-[120px] left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-lg max-h-[60vh] overflow-y-auto">
              <div className="p-4 space-y-2">
                <button
                  onClick={handleNewConversation}
                  className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-medium">محادثة جديدة</span>
                </button>
                
                {conversations.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">لا توجد محادثات سابقة</p>
                  </div>
                ) : (
                  conversations.map((conv, index) => (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                        currentConversationId === conv.id
                          ? 'bg-emerald-50 border-2 border-emerald-500'
                          : 'bg-slate-50 hover:bg-slate-100 border-2 border-transparent'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        currentConversationId === conv.id
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        <span className="text-sm font-semibold">{index + 1}</span>
                      </div>
                      <div className="flex-1 text-right">
                        <p className={`text-sm font-medium ${
                          currentConversationId === conv.id ? 'text-emerald-700' : 'text-slate-700'
                        }`}>
                          {conv.title || 'محادثة'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(conv.created_at).toLocaleDateString('ar-EG')}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
          
          {/* Chat Widget */}
          <div className="flex-1 p-4 overflow-auto">
            <div className="max-w-3xl mx-auto">
              <ChatWidget 
                conversationId={currentConversationId}
                onConversationChange={handleConversationChange}
                onMessageSent={handleMessageSent}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './context/AuthContext';
import ChatWidget from "./components/ChatWidget";
import ConversationSidebar from "./components/ConversationSidebar";
import Link from "next/link";
import { LogOut, Settings, Loader2, Menu, X } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const router = useRouter();
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  // Refresh sidebar when message is sent
  const handleMessageSent = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Handle conversation selection
  const handleSelectConversation = useCallback((conversationId: string | null) => {
    setCurrentConversationId(conversationId);
    setShowMobileSidebar(false);
  }, []);

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setShowMobileSidebar(false);
  }, []);

  // Handle logout
  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">جاري التوجيه لتسجيل الدخول...</p>
        </div>
      </div>
    );
  }

  const userName = user?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {showMobileSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
              SF
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-slate-800">Sphinx Fit</h1>
              <p className="text-xs text-slate-500">Customer Support</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <Link 
              href="/admin/products" 
              className="text-sm text-slate-600 hover:text-emerald-600 transition-colors flex items-center gap-1 p-2 rounded-lg hover:bg-slate-100"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">إدارة المنتجات</span>
            </Link>
            
            {/* User info and logout */}
            <div className="flex items-center gap-2 sm:gap-3 border-r pr-2 sm:pr-4 border-slate-200">
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-slate-800">{userName}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="تسجيل الخروج"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-slate-600 hidden sm:inline">Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Mobile Sidebar Overlay */}
        {showMobileSidebar && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setShowMobileSidebar(false)}
          />
        )}

        {/* Sidebar */}
        <aside 
          className={`
            fixed lg:relative inset-y-0 right-0 z-30 lg:z-0 
            transform transition-transform duration-300 ease-in-out
            ${showMobileSidebar ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
            mt-[60px] lg:mt-0
          `}
        >
          <ConversationSidebar
            currentConversationId={currentConversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            refreshTrigger={refreshTrigger}
          />
        </aside>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Welcome Header */}
          <div className="bg-white/50 backdrop-blur-sm border-b border-slate-200 px-4 py-4 text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">
              مرحباً {userName}! 💪
            </h2>
            <p className="text-sm text-slate-600">
              اسألني عن الطلبات، المنتجات، المقاسات، أو أي حاجة تانية
            </p>
          </div>

          {/* Chat Widget Container */}
          <div className="flex-1 overflow-auto p-4">
            <ChatWidget
              conversationId={currentConversationId}
              onConversationChange={setCurrentConversationId}
              onMessageSent={handleMessageSent}
            />
          </div>

          {/* Quick Features */}
          <div className="bg-white border-t border-slate-200 p-4">
            <div className="max-w-2xl mx-auto grid grid-cols-3 gap-2 sm:gap-4">
              <div className="text-center p-2 sm:p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 transition-colors cursor-pointer">
                <div className="text-xl sm:text-2xl mb-1">📦</div>
                <p className="text-xs sm:text-sm font-medium text-slate-700">تتبع الطلبات</p>
              </div>
              <div className="text-center p-2 sm:p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 transition-colors cursor-pointer">
                <div className="text-xl sm:text-2xl mb-1">👕</div>
                <p className="text-xs sm:text-sm font-medium text-slate-700">المنتجات</p>
              </div>
              <div className="text-center p-2 sm:p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 transition-colors cursor-pointer">
                <div className="text-xl sm:text-2xl mb-1">↩️</div>
                <p className="text-xs sm:text-sm font-medium text-slate-700">الإرجاع</p>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
          <p>© 2025 Sphinx Fit. Powered by AI Customer Support</p>
        </div>
      </footer>
    </div>
  );
}

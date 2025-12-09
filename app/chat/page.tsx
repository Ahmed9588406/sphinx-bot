'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../app/context/AuthContext';
import ConversationSidebar from '../../app/components/ConversationSidebar';
import ChatWidget from '../../app/components/ChatWidget';

export default function ChatPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/login');
  }, [loading, isAuthenticated, router]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!isAuthenticated) return <div className="p-6">Redirecting...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <ConversationSidebar currentConversationId={null} onSelectConversation={() => {}} onNewConversation={() => {}} />
        </div>
        <div className="lg:col-span-3">
          <ChatWidget />
        </div>
      </div>
    </div>
  );
}

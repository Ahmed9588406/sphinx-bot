'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';

export default function ChatFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Open chat"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-emerald-300"
      title="فتح الدردشة"
    >
      <MessageCircle className="w-6 h-6" />
    </button>
  );
}

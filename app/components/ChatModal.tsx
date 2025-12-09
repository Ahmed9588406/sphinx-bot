'use client';

import React from 'react';
import ChatWidget from './ChatWidget';

export default function ChatModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full md:w-[720px] max-h-[90vh] overflow-hidden p-4">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Sphinx Fit Chat</h3>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-700">Close</button>
          </div>
          <div className="p-0">
            <ChatWidget />
          </div>
        </div>
      </div>
    </div>
  );
}

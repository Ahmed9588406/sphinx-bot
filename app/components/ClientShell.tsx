'use client';

import React, { useState } from 'react';
import ChatFab from './ChatFab';
import ChatModal from './ChatModal';

export default function ClientShell() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ChatModal open={open} onClose={() => setOpen(false)} />
      <ChatFab onClick={() => setOpen(true)} />
    </>
  );
}

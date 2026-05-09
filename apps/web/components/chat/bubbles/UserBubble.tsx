'use client';
import React from 'react';
import BubbleShell from './BubbleShell';

export interface UserBubbleProps {
  text: string;
  timestamp?: string;
}

export function UserBubble({ text, timestamp }: UserBubbleProps) {
  return (
    <BubbleShell side="right" tone="user" timestamp={timestamp} avatar="You" width="min(560px, 80%)">
      <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
    </BubbleShell>
  );
}

export default UserBubble;

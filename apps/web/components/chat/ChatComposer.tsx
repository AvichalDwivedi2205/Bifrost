'use client';
import React, { useEffect, useRef, useState } from 'react';

export interface ChatComposerProps {
  disabled?: boolean;
  placeholder?: string;
  onSubmit: (text: string) => void;
  actionLabel?: string;
}

export default function ChatComposer({ disabled, placeholder, onSubmit, actionLabel = 'Send' }: ChatComposerProps) {
  const [value, setValue] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = 'auto';
    taRef.current.style.height = `${Math.min(taRef.current.scrollHeight, 180)}px`;
  }, [value]);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
    setValue('');
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 44,
        left: 0,
        right: 0,
        zIndex: 30,
        padding: '12px 16px',
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          background: 'var(--bg-elev)',
          border: '1px solid var(--hairline-strong)',
          borderRadius: 16,
          padding: '10px 12px',
          boxShadow: 'var(--shadow-md)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--text)',
            fontSize: 14,
            lineHeight: 1.5,
            fontFamily: 'inherit',
            padding: '6px 4px',
            minHeight: 24,
            maxHeight: 180,
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || value.trim().length === 0}
          style={{
            padding: '8px 14px',
            borderRadius: 12,
            border: '1px solid var(--accent)',
            background: 'oklch(0.78 0.16 75 / 0.18)',
            color: 'var(--accent)',
            fontSize: 13,
            fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled || value.trim().length === 0 ? 0.5 : 1,
            transition: 'all 0.15s var(--ease)',
            whiteSpace: 'nowrap',
          }}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

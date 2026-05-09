'use client';
import React, { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { modalEnter, modalEnterReduced } from '../bubbleVariants';

export interface PreviewIframeModalProps {
  open: boolean;
  onClose: () => void;
  previewUrl: string;
  label?: string;
}

export default function PreviewIframeModal({ open, onClose, previewUrl, label }: PreviewIframeModalProps) {
  const reduce = useReducedMotion();
  const variants = reduce ? modalEnterReduced : modalEnter;
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="preview-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'oklch(0.06 0.01 260 / 0.78)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={onClose}
        >
          <motion.div
            key="preview-modal"
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(1100px, 95vw)',
              height: 'min(720px, 86vh)',
              borderRadius: 16,
              background: 'var(--bg-elev)',
              border: '1px solid var(--hairline)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 16px',
                borderBottom: '1px solid var(--hairline)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>
                  {label ?? 'Preview'}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {previewUrl}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close preview"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid var(--hairline)',
                  background: 'var(--surface)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 16,
                }}
              >
                ×
              </button>
            </div>
            <iframe
              title={label ?? 'preview'}
              src={previewUrl}
              sandbox="allow-scripts allow-same-origin allow-forms"
              style={{
                flex: 1,
                width: '100%',
                border: 'none',
                background: '#fff',
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

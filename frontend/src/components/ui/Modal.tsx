'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  panelClassName?: string;
  dismissible?: boolean;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, dismissible = true, panelClassName }: ModalProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const overlay = panel.current?.parentElement;
    const background = Array.from(document.body.children).filter((element) =>
      element instanceof HTMLElement && element !== overlay && !element.hasAttribute('inert'));
    background.forEach((element) => element.setAttribute('inert', ''));
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
    ) ?? []).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
    if (!panel.current?.contains(document.activeElement)) {
      (panel.current?.querySelector<HTMLElement>('[autofocus]') ?? focusable()[0] ?? panel.current)?.focus();
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        event.preventDefault();
        close.current();
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) {
        event.preventDefault();
        panel.current?.focus();
      } else if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement) || document.activeElement === panel.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement) || document.activeElement === panel.current)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach((element) => element.removeAttribute('inert'));
      document.removeEventListener('keydown', handleKey);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [isOpen, dismissible]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden="true"
            className="modal-scrim absolute inset-0 bg-black/65 backdrop-blur-md"
            onClick={dismissible ? onClose : undefined}
          />

          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : 'Game dialog'}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            className={`relative max-h-[calc(100dvh-2rem)] w-full min-w-0 overflow-y-auto shadow-2xl ${panelClassName ?? 'premium-panel max-w-md p-6 sm:p-8'} ${dismissible ? 'pt-16 sm:pt-16' : ''}`}
          >
            {dismissible && <button type="button" onClick={onClose} aria-label="Close dialog" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-game-muted transition-colors hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>}
            {title && (
              <h2 id={titleId} className="mb-6 text-2xl font-semibold text-white">{title}</h2>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

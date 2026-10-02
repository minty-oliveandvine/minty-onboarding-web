'use client';

/**
 * PORT of minty-web/features/subscription/components/ModalFrame.tsx (Figma 04-G / section 06):
 * the page blurred behind a pale backdrop and one white card over it. Escape and a click on
 * the backdrop close it through `onDismiss`, unless `busy`.
 *
 * Plain CSS (`.mw-modal*` in app/globals.css) rather than minty-web's Tailwind classes:
 * this app's Tailwind scan does not reliably pick up new arbitrary classes in dev.
 * Rendered into <body> so no stacking context on the page can sit over it.
 * minty-web is the design source; its copy in minty-payment-request-web and the Flask port
 * (Minty static/js/minty_dialog.js) follow it. Change them together.
 */

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMounted } from '../lib/useMounted';

export function ModalFrame({
  labelledBy,
  busy = false,
  onDismiss,
  dismissLabel = 'Close',
  className = '',
  children,
}: {
  /** The id of the heading that names the dialog. */
  labelledBy: string;
  busy?: boolean;
  onDismiss: () => void;
  /** What the backdrop button says to a screen reader. */
  dismissLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  // Portals need the DOM; the wizard renders on the server first.
  const mounted = useMounted();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onDismiss]);

  if (!mounted) return null;
  return createPortal(
    <div className="mw-modal">
      <button
        type="button"
        aria-label={dismissLabel}
        onClick={onDismiss}
        disabled={busy}
        className="mw-modal-backdrop"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={'mw-modal-card ' + className}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

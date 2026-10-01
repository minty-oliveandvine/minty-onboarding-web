'use client';

// Canonical flash toast — ONE source of truth for user-facing messages.
//
// The house toast, the same card in every Minty app (minty-web's
// components/ui/Toast.tsx is the reference): a white card, a bold type label
// (Success / Error / Warning / Information), the message in grey and a close
// button, top-right. No per-type colour or icon by decision - the label carries
// the type. Auto-dismisses after 4 seconds; errors are role=alert.
//
// The interface is `toast.error(message)` (and .success/.warning/.info). One
// call per message you want shown. In the Flask app the equivalent channel is
// draining `get_flashed_messages()` on page load; here it's the `{ ok, error }`
// result objects that OnboardingApp's submit functions already return.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useMounted } from '../lib/useMounted';

export type Tone = 'success' | 'error' | 'warning' | 'info';

const LABEL: Record<Tone, string> = {
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
  info: 'Information',
};

const DISMISS_MS = 4000;

/** `toast.error(message)` and friends. One call per message you want shown. */
export type ToastApi = {
  show: (message: string, tone?: Tone) => void;
  hide: () => void;
  success: (message?: string) => void;
  error: (message?: string) => void;
  warning: (message?: string) => void;
  info: (message?: string) => void;
};

type ToastState = { id: number; message: string; tone: Tone };

const ToastContext = createContext<ToastApi | null>(null);

// Rendered once, at the app root. Holds the single visible toast; a new call
// replaces whatever is showing rather than stacking.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);
  // The portal targets document.body, which does not exist during server render.
  const mounted = useMounted();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  }, []);

  const show = useCallback((message: string, tone: Tone = 'success') => {
    if (!message) return;
    // Auto-dismiss is scoped to THIS invocation. The Flask version's comment is
    // worth keeping in mind: an earlier iteration swept every `.toast` in the
    // DOM on a timer, which killed unrelated client-side validation toasts.
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ id: Date.now(), message, tone: tone in LABEL ? tone : 'success' });
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), DISMISS_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  // One stable object for the life of the provider. `show` and `hide` are useCallbacks
  // with no deps, so this memo never recomputes -- the same identity the old
  // build-once-into-a-ref gave, without reading a ref during render.
  const api = useMemo<ToastApi>(
    () => ({
      show,
      hide,
      success: (m?: string) => show(m || 'All done!', 'success'),
      error: (m?: string) =>
        show(m || 'Something went wrong on my end. Mind trying again?', 'error'),
      warning: (m?: string) => show(m || 'Worth a quick look before you carry on.', 'warning'),
      info: (m?: string) => show(m || "Here's something worth knowing.", 'info'),
    }),
    [show, hide],
  );

  // Only the card that is showing is in the DOM: a parked off-screen card would
  // keep its stale role=alert where tests and screen readers can find it.
  const node = (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[400] w-80 max-w-[calc(100vw-2rem)]"
      aria-live="polite"
      aria-atomic="true"
    >
      {visible && toast ? (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 rounded border border-[#e5e7eb] bg-white p-3 text-sm text-[#171717] shadow"
          role={toast.tone === 'error' ? 'alert' : 'status'}
          data-toast-type={toast.tone}
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{LABEL[toast.tone]}</p>
            <p className="break-words text-[#6b7280]">{toast.message}</p>
          </div>
          <button
            type="button"
            className="cursor-pointer text-[#6b7280] hover:text-[#171717]"
            onClick={hide}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted && createPortal(node, document.body)}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

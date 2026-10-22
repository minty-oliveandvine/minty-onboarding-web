'use client';

// Slide-in navigation drawer mirroring Module 2 (payment-request) NavMenu —
// same design, Material Symbols icons, and Inter font. Items are visual
// placeholders for the onboarding flow (they close the drawer, no navigation).
import { useEffect, useId, useState } from 'react';
import { useMounted } from '@minty/shared/clientValue';
import { createPortal } from 'react-dom';
import { urlFor } from '../lib/apiRoutes';

const SECTIONS = [
  {
    title: 'Petty Cash',
    items: [
      { label: 'Dashboard', icon: 'space_dashboard' },
      { label: 'Reports', icon: 'bar_chart' },
    ],
  },
  {
    title: 'Payment Request',
    items: [{ label: 'Payments', icon: 'local_atm' }],
  },
];

type NavMenuProps = {
  companyName?: string;
  showFullMenu?: boolean;
};

export default function NavMenu({ companyName = 'Minty', showFullMenu = false }: NavMenuProps) {
  const [open, setOpen] = useState(false);
  const portalReady = useMounted();
  const panelId = useId();

  const handleLogout = () => {
    setOpen(false);
    window.location.href = urlFor(`/logout`);
  };

  const abbr = !showFullMenu
    ? '---'
    : (companyName || 'Minty')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .map((w) => w[0])
        .join('')
        .toUpperCase() || '---';

  useEffect(() => {
    if (!open) return;
    // Keep the page scrollable (scrollbar stays visible) while the menu is open.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const itemClass =
    'flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-base font-medium text-[var(--mv2-text-secondary)] transition-colors hover:bg-[var(--mv2-state-hover)]';

  const drawer = (
    <div
      className={`fixed inset-0 z-[200] overflow-x-hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={`absolute inset-0 cursor-pointer bg-[var(--mv2-scrim)] transition-opacity duration-300 ease-out ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={() => setOpen(false)}
        tabIndex={open ? 0 : -1}
        aria-label="Close menu"
      />
      <nav
        id={panelId}
        className={`absolute right-0 top-0 flex h-full w-[min(100%,14rem)] max-w-[calc(100%-env(safe-area-inset-left)-env(safe-area-inset-right))] flex-col rounded-l-[12px] border border-[var(--mv2-border-default)] bg-[var(--mv2-surface-card)] pt-[env(safe-area-inset-top,0px)] shadow-[var(--mv2-elevation-overlay)] transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        aria-label="Main navigation"
      >
        <div className="flex flex-col gap-3 border-b border-[var(--mv2-border-subtle)] px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span
              className="min-w-0 truncate text-sm font-semibold tracking-wide text-[var(--mv2-text-primary)] sm:text-base"
              title={abbr}
            >
              {abbr}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-[var(--mv2-text-secondary)] transition-colors hover:bg-[var(--mv2-state-hover)]"
              aria-label="Close menu"
            >
              <span className="material-symbols-rounded text-[26px] leading-none">close</span>
            </button>
          </div>
          {showFullMenu && (
            <button type="button" onClick={() => setOpen(false)} className={itemClass}>
              <span
                className="material-symbols-rounded shrink-0 text-[22px] leading-none text-[var(--mv2-text-secondary)]"
                aria-hidden
              >
                corporate_fare
              </span>
              Select entity
            </button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {showFullMenu && (
              <div className="w-full flex-none overflow-y-auto overscroll-contain">
                <div className="flex flex-col gap-3">
                  {SECTIONS.map((section) => (
                    <div
                      key={section.title}
                      className={`flex flex-col ${section.title === 'Payment Request' ? 'mt-6 gap-3' : 'gap-1'}`}
                      role="group"
                      aria-label={section.title}
                    >
                      <p className="px-3 text-[12px] font-semibold uppercase tracking-wider text-[var(--mv2-text-muted)]">
                        {section.title}
                      </p>
                      <ul className="flex flex-col gap-1">
                        {section.items.map((item) => (
                          <li key={item.label} className="w-full">
                            <button
                              type="button"
                              onClick={() => setOpen(false)}
                              className={itemClass}
                            >
                              <span
                                className="material-symbols-rounded shrink-0 text-[22px] leading-none text-[var(--mv2-text-secondary)]"
                                aria-hidden
                              >
                                {item.icon}
                              </span>
                              {item.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              className={`-mx-4 shrink-0 sm:-mx-6 ${showFullMenu ? 'mt-4 border-t border-[var(--mv2-border-subtle)]' : ''}`}
              role="presentation"
            >
              <div className="flex flex-col gap-1 px-4 pt-4 sm:px-6">
                {showFullMenu && (
                  <button type="button" onClick={() => setOpen(false)} className={itemClass}>
                    <span
                      className="material-symbols-rounded shrink-0 text-[22px] leading-none text-[var(--mv2-text-secondary)]"
                      aria-hidden
                    >
                      settings
                    </span>
                    Settings
                  </button>
                )}
                <button type="button" onClick={handleLogout} className={itemClass}>
                  <span
                    className="material-symbols-rounded shrink-0 text-[22px] leading-none text-[var(--mv2-text-secondary)]"
                    aria-hidden
                  >
                    logout
                  </span>
                  Logout
                </button>
              </div>
            </div>

            <div className="min-h-0 min-w-0 flex-1" aria-hidden />
            <div className="flex shrink-0 justify-center px-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sidepanel_cat.webp"
                alt=""
                className="h-auto w-[min(100%,10rem)] select-none object-contain"
                draggable={false}
              />
            </div>
          </div>
        </div>
      </nav>
    </div>
  );

  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Open navigation menu"
      >
        <span className="material-symbols-rounded text-[26px] leading-none">menu</span>
      </button>
      {portalReady ? createPortal(drawer, document.body) : null}
    </div>
  );
}

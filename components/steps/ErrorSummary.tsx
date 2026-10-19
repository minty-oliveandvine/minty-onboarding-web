'use client';

// Part 15.3 / 15.G error summary, as minty-payment-request-web's `components/ui/ErrorSummary`
// draws it: when a submit is refused with MORE THAN ONE problem, a list at the top of the form
// names each one and links to its field, and it takes focus so the person hears it. With exactly
// one problem the step focuses that field itself and this renders nothing.
//
// Wording follows Part 11 (issue, then action): "The country is still empty. Choose the
// company's country to continue." -- never "Error", "Invalid" or "Mandatory".

import { useEffect, useRef } from 'react';

export type SummaryItem = { fieldId: string; message: string };

export function ErrorSummary({
  items,
  attempt,
}: {
  items: SummaryItem[];
  /** Bumped on every refused submit, so the summary takes focus again on each one. */
  attempt: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const shown = items.length > 1;

  useEffect(() => {
    if (shown && attempt > 0) box.current?.focus();
  }, [shown, attempt]);

  if (!shown) return null;
  return (
    <div ref={box} tabIndex={-1} role="alert" className="error-summary">
      <p className="error-summary-title">
        {items.length} details need a look before this can be saved.
      </p>
      <ul>
        {items.map((it) => (
          <li key={it.fieldId}>
            <a
              href={`#${it.fieldId}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(it.fieldId)?.focus();
              }}
            >
              {it.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// COPY of minty-web/lib/emailInput.ts's hook (2026-10-01); the rules it uses live in
// lib/validation.ts here. Change every copy (minty-web, billing-frontend, the landing page,
// Flask static/js/email_input.js) until @minty/shared.

/**
 * Email fields take English only. They are `type='text' inputMode='email'`, not `type='email'`:
 * the browser's email input refuses Hangul before the '@' but accepts it after (an
 * international domain), and hands `.value` back as punycode - ASCII to every check, Korean on
 * screen. The strip waits for an IME composition to finish, because rewriting the value
 * mid-composition makes the Korean IME duplicate characters.
 */

import {
  useState,
  type ChangeEvent,
  type CompositionEvent,
  type InputHTMLAttributes,
} from 'react';

import { hasNonAsciiEmailChar, sanitizeEmailInput } from './validation';

type EmailInputProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  | 'type'
  | 'inputMode'
  | 'autoComplete'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'spellCheck'
  | 'onChange'
  | 'onCompositionEnd'
>;

/**
 * Spread `props` on the email `<input>` (after any `type`/`onChange` of its own) and render
 * `EMAIL_ASCII_HINT` while `rejected`. `onValue` gets the cleaned value; during a composition
 * it gets the raw one, so a controlled input does not fight the IME.
 */
export function useEmailInput(onValue?: (value: string) => void): {
  props: EmailInputProps;
  rejected: boolean;
} {
  const [rejected, setRejected] = useState(false);

  const settle = (el: HTMLInputElement) => {
    const raw = el.value;
    const clean = sanitizeEmailInput(raw);
    if (clean !== raw) {
      const caret = sanitizeEmailInput(raw.slice(0, el.selectionStart ?? raw.length)).length;
      el.value = clean;
      el.setSelectionRange(caret, caret);
    }
    setRejected(hasNonAsciiEmailChar(raw));
    onValue?.(clean);
  };

  return {
    rejected,
    props: {
      type: 'text',
      inputMode: 'email',
      autoComplete: 'email',
      autoCapitalize: 'none',
      autoCorrect: 'off',
      spellCheck: false,
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        if ((e.nativeEvent as InputEvent).isComposing) onValue?.(e.currentTarget.value);
        else settle(e.currentTarget);
      },
      onCompositionEnd: (e: CompositionEvent<HTMLInputElement>) => settle(e.currentTarget),
    },
  };
}

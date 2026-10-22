// errorCopy / friendlyError (@minty/shared/errorCopy; was lib/errorCopy) -- the one place a
// failure becomes a sentence the user reads.

import { describe, expect, it } from 'vitest';
import { HOUSE_FALLBACK, errorCopy, friendlyError } from '@minty/shared/errorCopy';

describe('errorCopy', () => {
  // Pinned before errorCopy, friendlyError and the house fallback moved to @minty/shared
  // (the shared-code refactor, 2026-10-21). The cases marked with the owner's date are the
  // shared module's stricter rules, re-pinned on purpose; the rest held unchanged.

  it('has the exact house fallback wording', () => {
    expect(HOUSE_FALLBACK).toBe('Something went wrong on my end. Mind trying again?');
  });

  it('passes a sentence through, trimmed', () => {
    expect(errorCopy('  That company name is taken.  ')).toBe('That company name is taken.');
  });

  it('falls back for null, undefined, empty and whitespace', () => {
    expect(errorCopy(null)).toBe(HOUSE_FALLBACK);
    expect(errorCopy(undefined)).toBe(HOUSE_FALLBACK);
    expect(errorCopy('')).toBe(HOUSE_FALLBACK);
    expect(errorCopy('   ')).toBe(HOUSE_FALLBACK);
  });

  it('uses the caller fallback, but an empty-string fallback still means the house one (||)', () => {
    expect(errorCopy(null, 'Custom.')).toBe('Custom.');
    expect(errorCopy(null, '')).toBe(HOUSE_FALLBACK);
  });

  it('falls back for a non-string: number, boolean, object', () => {
    expect(errorCopy(42)).toBe(HOUSE_FALLBACK);
    expect(errorCopy(true)).toBe(HOUSE_FALLBACK);
    expect(errorCopy({ detail: 'x' })).toBe(HOUSE_FALLBACK);
  });

  it('shows the sentence in a field-error map', () => {
    // owner 2026-10-21: one shared module (@minty/shared/errorCopy). Was: any object fell back.
    expect(errorCopy({ email: ['This field is required.'] })).toBe('This field is required.');
  });

  it('joins a list of strings with "; ", dropping blanks and non-strings', () => {
    expect(errorCopy(['Name is empty.', '  ', 3, null, 'Email is empty.'])).toBe(
      'Name is empty.; Email is empty.',
    );
    expect(errorCopy([])).toBe(HOUSE_FALLBACK);
    expect(errorCopy(['', 7])).toBe(HOUSE_FALLBACK);
  });

  it('keeps blank-padded list items untrimmed inside the join (only the whole is trimmed)', () => {
    expect(errorCopy([' One. ', ' Two. '])).toBe('One. ;  Two.');
  });

  it('accepts exactly 200 characters and falls back at 201', () => {
    const ok = 'A ' + 'x'.repeat(198);
    expect(ok).toHaveLength(200);
    expect(errorCopy(ok)).toBe(ok);
    expect(errorCopy(ok + 'x')).toBe(HOUSE_FALLBACK);
  });

  it('measures the length AFTER trimming', () => {
    const ok = 'A ' + 'x'.repeat(198);
    expect(errorCopy('   ' + ok + '   ')).toBe(ok);
  });

  it.each(['invalid_state', 'not-found', 'auth.expired', 'e:42', 'abc', '404'])(
    'treats bare lowercase code %s as machinery',
    (code) => {
      expect(errorCopy(code)).toBe(HOUSE_FALLBACK);
    },
  );

  it('falls back for a single word in any case', () => {
    // owner 2026-10-21: one shared module (@minty/shared/errorCopy). Was: a capitalised single word passed ("Forbidden", "INVALID_STATE").
    expect(errorCopy('Forbidden')).toBe(HOUSE_FALLBACK);
    expect(errorCopy('INVALID_STATE')).toBe(HOUSE_FALLBACK);
  });

  it.each([
    'Failed to fetch',
    'NetworkError when attempting to fetch resource.',
    'Load failed',
    'Unexpected token \'<\', "<!DOCTYPE " is not valid JSON',
    'Unexpected end of JSON input',
    'x.map is not a function',
    'foo is not defined',
    "Cannot read properties of undefined (reading 'id')",
    'TypeError: something broke',
    'Error: boom',
    'error: lower case too',
    'HTTP 502 from upstream',
    'Traceback (most recent call last):',
    'Got [object Object] back',
  ])('treats raw error text as machinery: %s', (raw) => {
    expect(errorCopy(raw)).toBe(HOUSE_FALLBACK);
  });

  it('only catches "...error:" at the very start, and only as one word', () => {
    expect(errorCopy('There was an error: try later.')).toBe('There was an error: try later.');
    expect(errorCopy('Some Error: here')).toBe('Some Error: here');
  });

  it('needs "http" as a word followed by three digits', () => {
    expect(errorCopy('Please use https 443 next time.')).toBe('Please use https 443 next time.');
    expect(errorCopy('HTTP 50 is not a status.')).toBe('HTTP 50 is not a status.');
    // owner 2026-10-21: one shared module (@minty/shared/errorCopy). Was: "http500" passed (no word boundary).
    expect(errorCopy('Server said http500')).toBe(HOUSE_FALLBACK);
  });

  it('falls back for markup and braces', () => {
    // owner 2026-10-21: one shared module (@minty/shared/errorCopy). Was: "<html>" passed; there was no markup pattern.
    expect(errorCopy('<html>Bad gateway</html>')).toBe(HOUSE_FALLBACK);
    expect(errorCopy('Bad value {x} here')).toBe(HOUSE_FALLBACK);
  });

  it('applies the patterns to a joined list too', () => {
    expect(errorCopy(['Name is empty.', 'Failed to fetch'])).toBe(HOUSE_FALLBACK);
  });
});

describe('friendlyError', () => {
  // Pinned before friendlyError moved to @minty/shared (the shared-code refactor, 2026-10-21).

  it('prefers `error`, then `message`', () => {
    expect(friendlyError({ error: 'Error sentence here.', message: 'Message.' })).toBe(
      'Error sentence here.',
    );
    expect(friendlyError({ message: 'Your code has expired.' })).toBe('Your code has expired.');
  });

  it('does NOT fall through to `message` when `error` holds text that is unusable', () => {
    expect(friendlyError({ error: 'invalid_state', message: 'A real sentence.' })).toBe(
      HOUSE_FALLBACK,
    );
  });

  it('skips an empty `error` and reads `detail` before `message`', () => {
    // owner 2026-10-21: one shared module (@minty/shared/errorCopy): the first field that flattens to text is judged, in the order error, detail,
    // message. Was: `error ?? message` - an empty-string `error` fell back, `detail` was never read.
    expect(friendlyError({ error: '', message: 'A real sentence.' })).toBe('A real sentence.');
    expect(friendlyError({ detail: 'That company was removed.', message: 'Other words.' })).toBe(
      'That company was removed.',
    );
    expect(friendlyError({ error: 'Error words here.', detail: 'Detail words here.' })).toBe(
      'Error words here.',
    );
  });

  it('falls through to `message` when `error` is null', () => {
    expect(
      friendlyError({ error: null, message: 'A real sentence.' } as unknown as {
        message: string;
      }),
    ).toBe('A real sentence.');
  });

  it('falls back for a null/undefined body, honouring the caller fallback', () => {
    expect(friendlyError(null)).toBe(HOUSE_FALLBACK);
    expect(friendlyError(undefined)).toBe(HOUSE_FALLBACK);
    expect(friendlyError(null, "I couldn't save those. Mind trying again?")).toBe(
      "I couldn't save those. Mind trying again?",
    );
    expect(friendlyError({})).toBe(HOUSE_FALLBACK);
  });

  it('accepts a list in `error`', () => {
    expect(friendlyError({ error: ['One.', 'Two.'] } as unknown as { error: string })).toBe(
      'One.; Two.',
    );
  });
});

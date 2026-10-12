// lib/validation -- the shallow shape checks the completion gate and the UI hints
// both read. They existed as separate copies before this module and could disagree
// about whether a form was valid, so what matters most here is that ONE rule answers
// both callers; the cases below pin what that rule accepts.

import { describe, expect, it } from 'vitest';
import {
  EMAIL_RE,
  UUID_RE,
  hasNonAsciiEmailChar,
  isEmail,
  isUuid,
  capNational,
  maxNationalDigits,
  phoneError,
  phoneForApi,
  sanitizeEmailInput,
  sanitizePhoneInput,
  splitStoredPhone,
  type DialCountry,
} from '../validation';

describe('isEmail', () => {
  it.each([
    'a@b.co',
    'first.last@example.com',
    'a+b@sub.domain.museum',
    "o'brien@example.ie",
    'user_name@example.co.uk',
    'UPPER@EXAMPLE.COM',
  ])('accepts %s', (value) => {
    expect(isEmail(value)).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'whitespace only'],
    ['plainaddress', 'no @'],
    ['@example.com', 'nothing before the @'],
    ['user@', 'nothing after the @'],
    ['user@example', 'no dot in the domain'],
    ['user @example.com', 'a space'],
    ['a@b@c.com', 'two @'],
    ['홍길동@example.com', 'Korean before the @'],
    ['user@회사.com', 'Korean after the @ (the browser would have let this through)'],
    ['josé@example.com', 'an accent'],
  ])('rejects %s (%s)', (value) => {
    expect(isEmail(value)).toBe(false);
  });

  it('trims before testing', () => {
    expect(isEmail('  a@b.co  ')).toBe(true);
  });

  it('treats null and undefined as empty rather than throwing', () => {
    // Called straight off an uncontrolled input's value in a few places, which can
    // be undefined on the first render.
    expect(isEmail(null)).toBe(false);
    expect(isEmail(undefined)).toBe(false);
  });

  it('is deliberately shallow -- it does not reject an unroutable domain', () => {
    // Documented behaviour, not an oversight: these addresses never authenticate
    // anybody, and a stricter parser rejects legitimate ones for no gain.
    expect(isEmail('a@b.c')).toBe(true);
  });

  it('is not sticky', () => {
    // A /g regex reused across calls carries lastIndex between them and returns
    // alternating answers for the same input. EMAIL_RE has no /g, and this is the
    // test that would notice if someone added one.
    expect(EMAIL_RE.global).toBe(false);
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('a@b.co')).toBe(true);
  });
});

describe('isUuid', () => {
  it('accepts a canonical uuid in either case', () => {
    expect(isUuid('2749a5a2-5a9f-482a-97df-af2b6a5ac0e6')).toBe(true);
    expect(isUuid('2749A5A2-5A9F-482A-97DF-AF2B6A5AC0E6')).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['2749a5a2-5a9f-482a-97df', 'too short'],
    ['2749a5a25a9f482a97dfaf2b6a5ac0e6', 'no hyphens'],
    ['2749a5a2-5a9f-482a-97df-af2b6a5ac0e6x', 'trailing character'],
    ['g749a5a2-5a9f-482a-97df-af2b6a5ac0e6', 'non-hex digit'],
    ['Office Supplies', 'a display value'],
  ])('rejects %s (%s)', (value) => {
    expect(isUuid(value)).toBe(false);
  });

  it('does NOT trim', () => {
    // Unlike isEmail. A uuid comes from the database or from a select's value, never
    // from something a user typed, so padding means the caller has a bug worth seeing.
    expect(isUuid(' 2749a5a2-5a9f-482a-97df-af2b6a5ac0e6 ')).toBe(false);
  });

  it('is anchored at both ends and not sticky', () => {
    expect(UUID_RE.source.startsWith('^')).toBe(true);
    expect(UUID_RE.source.endsWith('$')).toBe(true);
    expect(UUID_RE.global).toBe(false);
  });

  it('treats null and undefined as not a uuid', () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe('sanitizeEmailInput', () => {
  it('keeps printable ASCII on both sides of the @ and drops the rest, spaces included', () => {
    expect(sanitizeEmailInput('한user@회사example.com')).toBe('user@example.com');
    expect(sanitizeEmailInput(' é a@b.co ')).toBe('a@b.co');
    expect(sanitizeEmailInput("o'brien+x@example.ie")).toBe("o'brien+x@example.ie");
  });

  it('says when a character was not English', () => {
    expect(hasNonAsciiEmailChar('user@회사.com')).toBe(true);
    expect(hasNonAsciiEmailChar('user@example.com')).toBe(false);
  });
});

const DIAL: DialCountry[] = [
  { iso: 'HK', name: 'Hong Kong', code: '852' },
  { iso: 'SG', name: 'Singapore', code: '65' },
  { iso: 'US', name: 'United States', code: '1' },
  { iso: 'CA', name: 'Canada', code: '1' },
  { iso: 'IT', name: 'Italy', code: '39' },
];

describe('phoneError', () => {
  it('names the code and its one length where there is one', () => {
    expect(phoneError('852', '9123 4567')).toBe('');
    expect(phoneError('852', '9123 456')).toBe('A +852 number has 8 digits.');
    expect(phoneError('1', '212 555 0123')).toBe('');
  });

  it('holds only Hong Kong to an exact length - the one market Minty sells in', () => {
    expect(phoneError('65', '6123 456')).toBe(''); // Singapore: 7 digits passes, for now
    expect(phoneError('86', '1381234567')).toBe('');
  });

  it("uses E.164's bounds everywhere else", () => {
    expect(phoneError('44', '7700 900123')).toBe('');
    expect(phoneError('44', '770')).toBe('Please check the phone number.');
    expect(phoneError('44', '7700 9001 2345 67')).toBe('Please check the phone number.'); // 16 in all
  });

  it('drops the trunk 0 except where it is part of the number', () => {
    expect(phoneForApi('+44 07700 900123')).toBe('+447700900123');
    expect(phoneForApi('+39 06 1234 5678')).toBe('+390612345678');
  });
});

describe('capNational', () => {
  it('holds +852 to 8 digits, keeping the punctuation', () => {
    expect(maxNationalDigits('852')).toBe(8);
    expect(capNational('852', '9123 45678')).toBe('9123 4567');
    expect(capNational('852', '9123 4567')).toBe('9123 4567');
  });

  it("caps every other code at what E.164's 15 digits leave", () => {
    expect(maxNationalDigits('44')).toBe(13);
    expect(maxNationalDigits('1')).toBe(14);
  });

  it('does not spend the limit on a trunk 0 the number drops', () => {
    // "0" + 13 digits under +44: the 0 goes, so all 13 stay.
    expect(capNational('44', '0 7700 900123 456')).toBe('0 7700 900123 456');
    expect(capNational('39', '0612345678901234')).toBe('0612345678901'); // Italy keeps its 0
  });
});

describe('phoneForApi', () => {
  it('sends compact E.164, or "" for no number', () => {
    expect(phoneForApi('+852 9123-4567')).toBe('+85291234567');
    expect(phoneForApi('+85291234567')).toBe('+85291234567');
    expect(phoneForApi('')).toBe('');
  });
});

describe('sanitizePhoneInput', () => {
  it('keeps digits, the punctuation people type, and a leading +', () => {
    expect(sanitizePhoneInput('  +65 (6123) 45.67-x')).toBe('+65 (6123) 45.67-');
    expect(sanitizePhoneInput('9123+4567')).toBe('91234567');
  });
});

describe('splitStoredPhone', () => {
  it('splits a stored E.164 number, preferring the company country on a shared code', () => {
    expect(splitStoredPhone('+85291234567', DIAL, 'HK')).toEqual({ phone: '+852 91234567', iso: 'HK' });
    expect(splitStoredPhone('+12125550123', DIAL, 'CA')).toEqual({ phone: '+1 2125550123', iso: 'CA' });
    expect(splitStoredPhone('+12125550123', DIAL, 'HK')).toEqual({ phone: '+1 2125550123', iso: 'US' });
  });

  it("falls back to the code's main country, not the first alphabetically", () => {
    const shared: DialCountry[] = [
      { iso: 'GG', name: 'Guernsey', code: '44' },
      { iso: 'IM', name: 'Isle of Man', code: '44' },
      { iso: 'GB', name: 'United Kingdom', code: '44' },
    ];
    expect(splitStoredPhone('+447700900123', shared, 'HK')?.iso).toBe('GB');
    expect(splitStoredPhone('+447700900123', shared, 'GG')?.iso).toBe('GG');
  });

  it('reads a pre-picker digits-only number under the company country', () => {
    expect(splitStoredPhone('91234567', DIAL, 'HK')).toEqual({ phone: '+852 91234567', iso: 'HK' });
    // the old box let people type the code in front; it is not part of the national number
    expect(splitStoredPhone('85291234567', DIAL, 'HK')).toEqual({ phone: '+852 91234567', iso: 'HK' });
  });

  it('leaves alone what it cannot or need not split', () => {
    expect(splitStoredPhone('+852 91234567', DIAL, 'HK')).toBeNull();
    expect(splitStoredPhone('', DIAL, 'HK')).toBeNull();
    expect(splitStoredPhone('+99912345', DIAL, 'HK')).toBeNull();
    expect(splitStoredPhone('91234567', DIAL, 'AF')).toBeNull();
  });
});

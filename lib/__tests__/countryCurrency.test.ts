// lib/countryCurrency -- picking a country in step 1 preselects its currency (2026-10-13).
//
// /countries carries each country's currency_id. The preselect fills the currency only when
// the person has not chosen one, so it never overwrites a deliberate choice.

import { describe, expect, it } from 'vitest';

import { currencyForCountry } from '../countryCurrency';

const COUNTRIES = [
  { country_code: 'HK', currency_id: 'hkd-id' },
  { country_code: 'AU', currency_id: null },
];

describe('currencyForCountry', () => {
  it('fills an empty currency from the country', () => {
    expect(currencyForCountry(COUNTRIES, 'HK', '')).toBe('hkd-id');
  });

  it('never overwrites a currency already chosen', () => {
    expect(currencyForCountry(COUNTRIES, 'HK', 'usd-id')).toBe('usd-id');
  });

  it('leaves it empty for a country with no currency, or an unknown country', () => {
    expect(currencyForCountry(COUNTRIES, 'AU', '')).toBe('');
    expect(currencyForCountry(COUNTRIES, 'ZZ', '')).toBe('');
  });
});

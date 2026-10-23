// Picking a country in step 1 preselects its currency (2026-10-13).
//
// /countries carries each country's own currency (country_info.currency_id). The preselect
// only fills an EMPTY currency, so it never overwrites a currency the person chose.

type CountryCurrency = { country_code: string; currency_id: string | null };

/** The currency step 1 should show after `country` is picked: `current` when one is chosen,
 * else the country's own currency, else "". */
export function currencyForCountry(
  countries: CountryCurrency[],
  country: string,
  current: string,
): string {
  if (current) return current;
  return countries.find((c) => c.country_code === country)?.currency_id ?? "";
}

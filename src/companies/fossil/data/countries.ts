/* ═══════════════════════════════════════════════════════════════
 *  Where a supplier sits
 *
 *  The fixtures name countries seven different ways — "US" and
 *  "United States", "CH" and "China", "Denmark", "NL", "Vietnam" —
 *  which is three notations in one column and no way to sort or group
 *  it. One record per country, keyed by both the code and the name, so
 *  whichever form a fixture holds resolves to the same row.
 *
 *  The flag is the emoji, built from the ISO code's regional-indicator
 *  pair rather than stored: every flag is the two letters offset into
 *  the Unicode regional block, so a table of them would be a table of
 *  the same arithmetic done by hand.
 * ═══════════════════════════════════════════════════════════════ */

export interface Country {
  /** ISO 3166-1 alpha-2 — what the column prints. */
  code: string;
  name: string;
}

/**
 * The flag emoji for an ISO alpha-2 code.
 *
 * "US" → 🇺🇸. Each letter maps to its regional indicator symbol, 127397 above
 * the ASCII capital, and a pair of them renders as the flag.
 */
export function flagOf(code: string): string {
  if (code.length !== 2) return "";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)),
  );
}

const COUNTRIES: Country[] = [
  { code: "US", name: "United States" },
  { code: "CN", name: "China" },
  { code: "VN", name: "Vietnam" },
  { code: "DK", name: "Denmark" },
  { code: "NL", name: "Netherlands" },
  { code: "CH", name: "Switzerland" },
  { code: "DE", name: "Germany" },
  { code: "IN", name: "India" },
  { code: "MX", name: "Mexico" },
  { code: "TW", name: "Taiwan" },
  { code: "HK", name: "Hong Kong" },
  { code: "KH", name: "Cambodia" },
  { code: "BD", name: "Bangladesh" },
  { code: "JP", name: "Japan" },
];

/* Both spellings of every country point at one record. */
const BY_KEY = new Map<string, Country>();
for (const c of COUNTRIES) {
  BY_KEY.set(c.code.toLowerCase(), c);
  BY_KEY.set(c.name.toLowerCase(), c);
}

/**
 * The country a fixture value means, whichever way it was written.
 *
 * Regions — "Europe", "Asia" — are not countries and resolve to nothing, which
 * is the honest answer: the caller falls back to printing the region as text
 * rather than flying a flag for a continent.
 */
export function countryOf(value: string | undefined): Country | undefined {
  return value ? BY_KEY.get(value.trim().toLowerCase()) : undefined;
}

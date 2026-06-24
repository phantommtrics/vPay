export const COUNTRIES = [
  { code: 'gm', name: 'The Gambia' },
  { code: 'sn', name: 'Senegal' },
  { code: 'ng', name: 'Nigeria' },
  { code: 'gh', name: 'Ghana' },
  { code: 'mx', name: 'Mexico' },
  { code: 'us', name: 'United States' },
  { code: 'gb', name: 'United Kingdom' },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]['code'];

export function getCountryName(code: string | null | undefined): string {
  if (!code) return '';
  return COUNTRIES.find((c) => c.code === code.toLowerCase())?.name ?? code;
}

export function getCountryCode(nameOrCode: string | null | undefined): string {
  if (!nameOrCode) return 'gm';
  const trimmed = nameOrCode.trim();
  const byCode = COUNTRIES.find((c) => c.code === trimmed.toLowerCase());
  if (byCode) return byCode.code;
  const byName = COUNTRIES.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  return byName?.code ?? 'gm';
}

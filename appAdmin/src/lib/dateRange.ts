/** ISO date YYYY-MM-DD in local calendar. */
export function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayIso(): string {
  return formatIsoDate(new Date());
}

export type DateRange = { startDate: string; endDate: string };

export function currentMonthRange(): DateRange {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return { startDate: formatIsoDate(monthStart), endDate: formatIsoDate(today) };
}

export function todayRange(): DateRange {
  const iso = todayIso();
  return { startDate: iso, endDate: iso };
}

export function last7DaysRange(): DateRange {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  return { startDate: formatIsoDate(start), endDate: formatIsoDate(today) };
}

export function formatDateRangeLabel(range: DateRange): string {
  const from = new Date(`${range.startDate}T12:00:00`);
  const to = new Date(`${range.endDate}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const a = from.toLocaleDateString('en-GB', opts);
  const b = to.toLocaleDateString('en-GB', opts);
  return range.startDate === range.endDate ? a : `${a} – ${b}`;
}

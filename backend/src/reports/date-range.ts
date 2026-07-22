const MAX_REPORT_RANGE_DAYS = 366;
const DEFAULT_REPORT_RANGE_DAYS = 30;

function toUtcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function reportCreatedAtFilter(
  startDate?: string,
  endDate?: string,
): { gte: Date; lt: Date } | undefined {
  if (!startDate && !endDate) return undefined;

  const startStr = startDate ?? endDate!;
  const endStr = endDate ?? startDate!;

  const start = toUtcDate(startStr);
  const endExclusive = toUtcDate(endStr);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
    throw new Error('Invalid date');
  }

  return { gte: start, lt: endExclusive };
}

export function resolveBoundedReportDateRange(input: {
  startDate?: string;
  endDate?: string;
  required?: boolean;
}): { startDate: string; endDate: string; filter: { gte: Date; lt: Date } } {
  const today = new Date();
  const defaultEnd = formatUtcDate(today);
  const defaultStartDate = new Date(today);
  defaultStartDate.setUTCDate(defaultStartDate.getUTCDate() - (DEFAULT_REPORT_RANGE_DAYS - 1));

  const startDate = input.startDate ?? defaultStartDate.toISOString().slice(0, 10);
  const endDate = input.endDate ?? defaultEnd;

  if (startDate > endDate) {
    throw new Error('startDate must be on or before endDate');
  }

  const filter = reportCreatedAtFilter(startDate, endDate);
  if (!filter) {
    throw new Error('Invalid date range');
  }

  const rangeDays = Math.ceil((filter.lt.getTime() - filter.gte.getTime()) / (24 * 60 * 60 * 1000));
  if (rangeDays > MAX_REPORT_RANGE_DAYS) {
    throw new Error(`Date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days`);
  }

  if (input.required && !input.startDate && !input.endDate) {
    // defaulted range is acceptable
  }

  return { startDate, endDate, filter };
}

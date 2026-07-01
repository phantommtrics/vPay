export function reportCreatedAtFilter(
  startDate?: string,
  endDate?: string,
): { gte: Date; lt: Date } | undefined {
  if (!startDate && !endDate) return undefined;

  const startStr = startDate ?? endDate!;
  const endStr = endDate ?? startDate!;

  const start = new Date(`${startStr}T00:00:00.000Z`);
  const endExclusive = new Date(`${endStr}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
    throw new Error('Invalid date');
  }

  return { gte: start, lt: endExclusive };
}

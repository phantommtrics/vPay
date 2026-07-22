import { z } from 'zod';

const MAX_REPORT_LIMIT = 100;
const DEFAULT_REPORT_LIMIT = 25;

export const reportLimitSchema = z.coerce.number().int().min(1).max(MAX_REPORT_LIMIT).optional();

export function parseReportLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_REPORT_LIMIT;
  return Math.min(Math.max(value, 1), MAX_REPORT_LIMIT);
}

export function slicePage<T>(rows: T[], limit: number): {
  items: T[];
  hasMore: boolean;
  nextCursor: string | null;
  cursorFrom: (item: T) => string;
} {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    hasMore,
    nextCursor: null,
    cursorFrom: () => '',
  };
}

export function nextCursorFromItems<T>(
  items: T[],
  hasMore: boolean,
  getId: (item: T) => string,
): string | null {
  if (!hasMore || items.length === 0) return null;
  return getId(items[items.length - 1]!);
}

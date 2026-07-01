import type { KycReviewAction, User } from '@prisma/client';

import { prisma } from '../db.js';

export function utcDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dayRangeUtc(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid date');
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function buildSearchFilter(search: string | undefined) {
  if (!search?.trim()) return undefined;
  const q = search.trim();
  return {
    OR: [
      { customerEmail: { contains: q, mode: 'insensitive' as const } },
      { customerFirstName: { contains: q, mode: 'insensitive' as const } },
      { customerLastName: { contains: q, mode: 'insensitive' as const } },
      { adminEmail: { contains: q, mode: 'insensitive' as const } },
      { adminFirstName: { contains: q, mode: 'insensitive' as const } },
      { adminLastName: { contains: q, mode: 'insensitive' as const } },
    ],
  };
}

export type KycAuditActor = {
  id: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export async function recordKycReviewAudit(params: {
  customer: User;
  admin: KycAuditActor;
  action: KycReviewAction;
  rejectionReason?: string | null;
}): Promise<void> {
  await prisma.kycReviewAudit.create({
    data: {
      customerUserId: params.customer.id,
      adminUserId: params.admin.id,
      action: params.action,
      rejectionReason: params.rejectionReason ?? null,
      customerEmail: params.customer.email,
      customerFirstName: params.customer.firstName,
      customerLastName: params.customer.lastName,
      adminEmail: params.admin.email,
      adminFirstName: params.admin.firstName,
      adminLastName: params.admin.lastName,
    },
  });
}

export type KycReviewSummaryRow = {
  adminUserId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  action: 'approved' | 'rejected';
  count: number;
  lastAt: string;
};

function adminGroupKey(adminUserId: string | null, adminEmail: string): string {
  return adminUserId ?? adminEmail;
}

export async function getKycReviewSummary(params: {
  date: string;
  search?: string;
}): Promise<{
  date: string;
  search: string | null;
  totals: { approved: number; rejected: number; total: number };
  rows: KycReviewSummaryRow[];
}> {
  const { start, end } = dayRangeUtc(params.date);
  const searchFilter = buildSearchFilter(params.search);

  const audits = await prisma.kycReviewAudit.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      ...(searchFilter ?? {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  const map = new Map<string, KycReviewSummaryRow>();
  let approvedTotal = 0;
  let rejectedTotal = 0;

  for (const audit of audits) {
    const action = audit.action === 'APPROVED' ? 'approved' : 'rejected';
    if (action === 'approved') approvedTotal += 1;
    else rejectedTotal += 1;

    const key = `${adminGroupKey(audit.adminUserId, audit.adminEmail)}:${action}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        adminUserId: audit.adminUserId,
        email: audit.adminEmail,
        firstName: audit.adminFirstName,
        lastName: audit.adminLastName,
        action,
        count: 1,
        lastAt: audit.createdAt.toISOString(),
      });
      continue;
    }
    existing.count += 1;
    if (audit.createdAt.toISOString() > existing.lastAt) {
      existing.lastAt = audit.createdAt.toISOString();
    }
  }

  const rows = [...map.values()].sort((a, b) => {
    const adminA = `${a.lastName ?? ''}${a.firstName ?? ''}${a.email}`.toLowerCase();
    const adminB = `${b.lastName ?? ''}${b.firstName ?? ''}${b.email}`.toLowerCase();
    if (adminA !== adminB) return adminA.localeCompare(adminB);
    if (a.action !== b.action) return a.action === 'approved' ? -1 : 1;
    return b.lastAt.localeCompare(a.lastAt);
  });

  return {
    date: params.date,
    search: params.search?.trim() || null,
    totals: {
      approved: approvedTotal,
      rejected: rejectedTotal,
      total: audits.length,
    },
    rows,
  };
}

export type KycReviewAuditRecord = {
  id: string;
  action: 'approved' | 'rejected';
  rejectionReason: string | null;
  createdAt: string;
  customer: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  admin: {
    id: string | null;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
};

function formatAuditRow(row: {
  id: string;
  action: KycReviewAction;
  rejectionReason: string | null;
  createdAt: Date;
  customerUserId: string;
  customerEmail: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  adminUserId: string | null;
  adminEmail: string;
  adminFirstName: string | null;
  adminLastName: string | null;
}): KycReviewAuditRecord {
  return {
    id: row.id,
    action: row.action === 'APPROVED' ? 'approved' : 'rejected',
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    customer: {
      id: row.customerUserId,
      email: row.customerEmail,
      firstName: row.customerFirstName,
      lastName: row.customerLastName,
    },
    admin: {
      id: row.adminUserId,
      email: row.adminEmail,
      firstName: row.adminFirstName,
      lastName: row.adminLastName,
    },
  };
}

export async function listKycReviewAudits(params: {
  date: string;
  search?: string;
  action?: 'approved' | 'rejected';
  cursor?: string;
  limit?: number;
}): Promise<{ records: KycReviewAuditRecord[]; nextCursor: string | null; limit: number }> {
  const { start, end } = dayRangeUtc(params.date);
  const searchFilter = buildSearchFilter(params.search);
  const limit = params.limit ?? 25;

  const actionFilter =
    params.action === 'approved'
      ? { action: 'APPROVED' as const }
      : params.action === 'rejected'
        ? { action: 'REJECTED' as const }
        : {};

  const rows = await prisma.kycReviewAudit.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      ...(searchFilter ?? {}),
      ...actionFilter,
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;

  return {
    records: slice.map(formatAuditRow),
    nextCursor: hasMore ? slice[slice.length - 1]?.id ?? null : null,
    limit,
  };
}

import { prisma } from '../db.js';
import { toAdminUserDevice, type AdminUserDevice } from './service.js';

export type CustomerDeviceGroupSummary = {
  groupKey: string;
  groupType: 'hardware' | 'device';
  hardwareId: string | null;
  representativeDeviceId: string;
  userCount: number;
  deviceName: string | null;
  brand: string | null;
  modelName: string | null;
  osName: string | null;
  osVersion: string | null;
  isEmulator: boolean;
  lastSeenAt: string;
};

export type CustomerDeviceLinkedUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  kycStatus: string;
  kycComplete: boolean;
  kycSubmittedAt: string | null;
  documentType: string | null;
  country: string | null;
  deviceRecordId: string;
  deviceLastSeenAt: string;
};

export type CustomerDeviceGroupDetail = {
  groupKey: string;
  groupType: 'hardware' | 'device';
  hardwareId: string | null;
  userCount: number;
  devices: AdminUserDevice[];
  users: CustomerDeviceLinkedUser[];
};

type GroupRow = {
  group_key: string;
  group_type: string;
  hardware_id: string | null;
  user_count: number;
  representative_device_id: string;
  device_name: string | null;
  brand: string | null;
  model_name: string | null;
  os_name: string | null;
  os_version: string | null;
  is_emulator: boolean;
  last_seen_at: Date;
};

function toGroupSummary(row: GroupRow): CustomerDeviceGroupSummary {
  return {
    groupKey: row.group_key,
    groupType: row.group_type === 'hardware' ? 'hardware' : 'device',
    hardwareId: row.hardware_id,
    representativeDeviceId: row.representative_device_id,
    userCount: row.user_count,
    deviceName: row.device_name,
    brand: row.brand,
    modelName: row.model_name,
    osName: row.os_name,
    osVersion: row.os_version,
    isEmulator: row.is_emulator,
    lastSeenAt: row.last_seen_at.toISOString(),
  };
}

function buildSearchPattern(search?: string): string | null {
  const trimmed = search?.trim();
  if (!trimmed) return null;
  return `%${trimmed}%`;
}

const GROUP_LIST_SQL = `
  SELECT
    COALESCE(hardware_id, id::text) AS group_key,
    CASE WHEN MAX(hardware_id) IS NOT NULL THEN 'hardware' ELSE 'device' END AS group_type,
    MAX(hardware_id) AS hardware_id,
    COUNT(DISTINCT user_id)::int AS user_count,
    (ARRAY_AGG(id ORDER BY last_seen_at DESC))[1] AS representative_device_id,
    (ARRAY_AGG(device_name ORDER BY last_seen_at DESC))[1] AS device_name,
    (ARRAY_AGG(brand ORDER BY last_seen_at DESC))[1] AS brand,
    (ARRAY_AGG(model_name ORDER BY last_seen_at DESC))[1] AS model_name,
    (ARRAY_AGG(os_name ORDER BY last_seen_at DESC))[1] AS os_name,
    (ARRAY_AGG(os_version ORDER BY last_seen_at DESC))[1] AS os_version,
    BOOL_OR(is_emulator) AS is_emulator,
    MAX(last_seen_at) AS last_seen_at
  FROM user_devices
  WHERE ($1::text IS NULL OR id::text ILIKE $1 OR hardware_id ILIKE $1 OR fingerprint ILIKE $1)
  GROUP BY COALESCE(hardware_id, id::text)
  ORDER BY user_count DESC, last_seen_at DESC
  LIMIT $2 OFFSET $3
`;

const GROUP_COUNT_SQL = `
  SELECT COUNT(*)::int AS total
  FROM (
    SELECT COALESCE(hardware_id, id::text) AS group_key
    FROM user_devices
    WHERE ($1::text IS NULL OR id::text ILIKE $1 OR hardware_id ILIKE $1 OR fingerprint ILIKE $1)
    GROUP BY COALESCE(hardware_id, id::text)
  ) grouped
`;

export async function listCustomerDeviceGroups(params: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  groups: CustomerDeviceGroupSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(params.page ?? 1, 1);
  const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
  const offset = (page - 1) * limit;
  const searchPattern = buildSearchPattern(params.search);

  const [rows, countRows] = await Promise.all([
    prisma.$queryRawUnsafe<GroupRow[]>(GROUP_LIST_SQL, searchPattern, limit, offset),
    prisma.$queryRawUnsafe<Array<{ total: number }>>(GROUP_COUNT_SQL, searchPattern),
  ]);

  const total = countRows[0]?.total ?? 0;

  return {
    groups: rows.map(toGroupSummary),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

export async function getCustomerDeviceGroupDetail(
  groupType: 'hardware' | 'device',
  groupKey: string,
): Promise<CustomerDeviceGroupDetail | null> {
  const devices = await prisma.userDevice.findMany({
    where: groupType === 'hardware' ? { hardwareId: groupKey } : { id: groupKey },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          kycStatus: true,
          kycComplete: true,
          kycSubmittedAt: true,
          documentType: true,
          country: true,
        },
      },
    },
    orderBy: { lastSeenAt: 'desc' },
  });

  if (devices.length === 0) {
    return null;
  }

  const usersById = new Map<string, CustomerDeviceLinkedUser>();
  for (const device of devices) {
    const existing = usersById.get(device.userId);
    if (existing && existing.deviceLastSeenAt >= device.lastSeenAt.toISOString()) {
      continue;
    }

    usersById.set(device.userId, {
      id: device.user.id,
      email: device.user.email,
      firstName: device.user.firstName,
      lastName: device.user.lastName,
      kycStatus: device.user.kycStatus.toLowerCase(),
      kycComplete: device.user.kycComplete,
      kycSubmittedAt: device.user.kycSubmittedAt?.toISOString() ?? null,
      documentType: device.user.documentType,
      country: device.user.country,
      deviceRecordId: device.id,
      deviceLastSeenAt: device.lastSeenAt.toISOString(),
    });
  }

  const users = [...usersById.values()].sort(
    (a, b) => b.deviceLastSeenAt.localeCompare(a.deviceLastSeenAt),
  );

  return {
    groupKey,
    groupType,
    hardwareId: groupType === 'hardware' ? groupKey : devices[0]?.hardwareId ?? null,
    userCount: users.length,
    devices: devices.map(toAdminUserDevice),
    users,
  };
}

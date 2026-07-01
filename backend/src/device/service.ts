import type { UserDevice } from '@prisma/client';
import type { User } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../db.js';
import { log } from '../logger.js';

export const deviceInfoSchema = z.object({
  fingerprint: z.string().min(1).max(128),
  deviceName: z.string().max(200).optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  manufacturer: z.string().max(100).optional().nullable(),
  modelName: z.string().max(100).optional().nullable(),
  deviceType: z.string().max(50).optional().nullable(),
  osName: z.string().max(50).optional().nullable(),
  osVersion: z.string().max(50).optional().nullable(),
  imei: z.string().max(50).optional().nullable(),
  hardwareId: z.string().max(128).optional().nullable(),
  isEmulator: z.boolean().optional(),
  appVersion: z.string().max(50).optional().nullable(),
});

export type DeviceInfoInput = z.infer<typeof deviceInfoSchema>;

export type PublicUserDevice = {
  id: string;
  deviceName: string | null;
  brand: string | null;
  manufacturer: string | null;
  modelName: string | null;
  deviceType: string | null;
  osName: string | null;
  osVersion: string | null;
  isEmulator: boolean;
  appVersion: string | null;
  lastSeenAt: string;
  createdAt: string;
};

export type AdminUserDevice = PublicUserDevice & {
  fingerprint: string;
  hardwareId: string | null;
  imei: string | null;
  lastIpAddress: string | null;
};

function toPublicUserDevice(device: UserDevice): PublicUserDevice {
  return {
    id: device.id,
    deviceName: device.deviceName,
    brand: device.brand,
    manufacturer: device.manufacturer,
    modelName: device.modelName,
    deviceType: device.deviceType,
    osName: device.osName,
    osVersion: device.osVersion,
    isEmulator: device.isEmulator,
    appVersion: device.appVersion,
    lastSeenAt: device.lastSeenAt.toISOString(),
    createdAt: device.createdAt.toISOString(),
  };
}

export function toAdminUserDevice(device: UserDevice): AdminUserDevice {
  return {
    ...toPublicUserDevice(device),
    fingerprint: device.fingerprint,
    hardwareId: device.hardwareId,
    imei: device.imei,
    lastIpAddress: device.lastIpAddress,
  };
}

export async function listUserDevicesForAdmin(userId: string): Promise<AdminUserDevice[]> {
  const devices = await prisma.userDevice.findMany({
    where: { userId },
    orderBy: { lastSeenAt: 'desc' },
  });

  return devices.map(toAdminUserDevice);
}

export async function findUserDeviceForAdmin(
  userId: string,
  deviceId: string,
): Promise<AdminUserDevice | null> {
  const device = await prisma.userDevice.findFirst({
    where: { id: deviceId, userId },
  });

  return device ? toAdminUserDevice(device) : null;
}

export async function clearUserDeviceLock(userId: string): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      deviceLockEnabled: false,
      lockedDeviceId: null,
    },
  });
}

export async function registerOrUpdateUserDevice(
  userId: string,
  input: DeviceInfoInput,
  ipAddress?: string | null,
): Promise<PublicUserDevice> {
  const now = new Date();

  const device = await prisma.userDevice.upsert({
    where: {
      userId_fingerprint: {
        userId,
        fingerprint: input.fingerprint,
      },
    },
    create: {
      userId,
      fingerprint: input.fingerprint,
      deviceName: input.deviceName ?? null,
      brand: input.brand ?? null,
      manufacturer: input.manufacturer ?? null,
      modelName: input.modelName ?? null,
      deviceType: input.deviceType ?? null,
      osName: input.osName ?? null,
      osVersion: input.osVersion ?? null,
      imei: input.imei ?? null,
      hardwareId: input.hardwareId ?? null,
      isEmulator: input.isEmulator ?? false,
      appVersion: input.appVersion ?? null,
      lastIpAddress: ipAddress ?? null,
      lastSeenAt: now,
    },
    update: {
      deviceName: input.deviceName ?? null,
      brand: input.brand ?? null,
      manufacturer: input.manufacturer ?? null,
      modelName: input.modelName ?? null,
      deviceType: input.deviceType ?? null,
      osName: input.osName ?? null,
      osVersion: input.osVersion ?? null,
      imei: input.imei ?? null,
      hardwareId: input.hardwareId ?? null,
      isEmulator: input.isEmulator ?? false,
      appVersion: input.appVersion ?? null,
      lastIpAddress: ipAddress ?? null,
      lastSeenAt: now,
    },
  });

  log('User device registered', { userId, deviceId: device.id, fingerprint: input.fingerprint });
  return toPublicUserDevice(device);
}

export async function resolveUserDeviceId(
  userId: string,
  deviceId: string | undefined,
): Promise<string | null> {
  if (!deviceId) {
    return null;
  }

  const device = await prisma.userDevice.findFirst({
    where: { id: deviceId, userId },
    select: { id: true },
  });

  return device?.id ?? null;
}

export function getClientIp(req: { headers: Record<string, unknown>; ip?: string }): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  return req.ip ?? null;
}

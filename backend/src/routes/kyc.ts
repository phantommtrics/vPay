import { mkdirSync } from 'node:fs';
import path from 'node:path';

import multer from 'multer';
import type { NextFunction, Response } from 'express';
import { z } from 'zod';

import {
  canEditKyc,
  findUserById,
  submitKycForReview,
  toPublicUser,
  updateUserProfile,
} from '../db.js';
import { log } from '../logger.js';
import { notifyAdminsKycSubmitted } from '../push/admin-notify.js';
import { formatZodError } from '../zod-utils.js';
import { WalletPhoneConflictError } from '../wallet/service.js';
import { PhoneAlreadyInUseError } from '../phone.js';
import { UPLOADS_DIR } from '../paths.js';
import type { AuthedRequest } from './auth.js';
import type { DeviceAuthedRequest } from '../middleware/device.js';

const uploadsDir = UPLOADS_DIR;

mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as AuthedRequest).userId ?? 'unknown';
    const side = (req.query.side as string) ?? 'file';
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${userId}-${side}-${Date.now()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image files are allowed'));
  },
});

export function handleKycUpload(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Image is too large. Maximum size is 10 MB.' });
      return;
    }

    res.status(400).json({
      error: err instanceof Error ? err.message : 'Upload failed',
    });
  });
}

const submitBodySchema = z.object({
  documentType: z.enum(['national_id', 'passport', 'drivers_license', 'residence_permit']).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  postalCode: z.string().optional(),
  acceptCardTerms: z.boolean().optional(),
});

const submitSchema = z.object({
  documentType: z.enum(['national_id', 'passport', 'drivers_license', 'residence_permit']),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().min(6, 'Phone number is required'),
  dateOfBirth: z.string().min(4, 'Date of birth is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  countryCode: z.string().min(2).max(2).optional(),
  postalCode: z.string().min(1, 'Postal code is required'),
  acceptCardTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the card terms' }),
  }),
});

const DOCUMENT_TYPES = [
  'national_id',
  'passport',
  'drivers_license',
  'residence_permit',
] as const;

export async function handleUploadDocument(
  req: AuthedRequest,
  res: Response,
): Promise<void> {
  const user = await findUserById(req.userId!);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (!canEditKyc(user)) {
    res.status(403).json({ error: 'Documents cannot be changed while verification is in progress' });
    return;
  }

  const side = req.query.side;
  if (side !== 'front' && side !== 'back' && side !== 'selfie') {
    res.status(400).json({ error: 'Invalid side. Use front, back, or selfie.' });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const url = `/uploads/${file.filename}`;
  const update =
    side === 'front'
      ? { documentFrontUrl: url }
      : side === 'back'
        ? { documentBackUrl: url }
        : { selfieUrl: url };

  log('KYC document uploaded', { userId: req.userId, side, filename: file.filename });

  const updated = await updateUserProfile(req.userId!, update);
  res.json({ url, user: await toPublicUser(updated) });
}

export async function handleSubmitKyc(req: DeviceAuthedRequest, res: Response): Promise<void> {
  log('KYC submit requested', { userId: req.userId, bodyKeys: Object.keys(req.body ?? {}) });

  const current = await findUserById(req.userId!);
  if (!current) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const parsedBody = submitBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    const error = formatZodError(parsedBody.error);
    log('KYC submit validation failed', { userId: req.userId, error });
    res.status(400).json({ error });
    return;
  }

  const merged = {
    documentType: parsedBody.data.documentType ?? (current.documentType as typeof DOCUMENT_TYPES[number] | null),
    firstName: (parsedBody.data.firstName ?? current.firstName ?? '').trim(),
    lastName: (parsedBody.data.lastName ?? current.lastName ?? '').trim(),
    phone: (parsedBody.data.phone ?? current.phone ?? '').trim(),
    dateOfBirth: (parsedBody.data.dateOfBirth ?? current.dateOfBirth ?? '').trim(),
    address: (parsedBody.data.address ?? current.address ?? '').trim(),
    city: (parsedBody.data.city ?? current.city ?? '').trim(),
    country: (parsedBody.data.country ?? current.country ?? '').trim(),
    countryCode: (parsedBody.data.countryCode ?? current.countryCode ?? '').trim() || undefined,
    postalCode: (parsedBody.data.postalCode ?? current.postalCode ?? '').trim(),
    acceptCardTerms: parsedBody.data.acceptCardTerms ?? false,
  };

  const parsed = submitSchema.safeParse(merged);
  if (!parsed.success) {
    const error = formatZodError(parsed.error);
    log('KYC submit validation failed', { userId: req.userId, error, merged });
    res.status(400).json({ error });
    return;
  }

  if (!DOCUMENT_TYPES.includes(parsed.data.documentType)) {
    res.status(400).json({ error: 'Invalid document type' });
    return;
  }

  try {
    const user = await submitKycForReview(req.userId!, parsed.data, req.deviceId);
    void notifyAdminsKycSubmitted(user).catch((err) => {
      log('KYC push notification failed', {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
    res.json({ user: await toPublicUser(user) });
  } catch (err) {
    if (err instanceof PhoneAlreadyInUseError || err instanceof WalletPhoneConflictError) {
      res.status(409).json({ error: err.message });
      return;
    }
    log('KYC submit failed', {
      userId: req.userId,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Failed to submit verification',
    });
  }
}

const documentTypeSchema = z.object({
  documentType: z.enum(['national_id', 'passport', 'drivers_license', 'residence_permit']),
});

export async function handleUpdateDocumentType(
  req: AuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = documentTypeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' });
    return;
  }

  try {
    const user = await updateUserProfile(req.userId!, {
      documentType: parsed.data.documentType,
    });
    res.json({ user: await toPublicUser(user) });
  } catch (err) {
    res.status(403).json({
      error: err instanceof Error ? err.message : 'Cannot update document type',
    });
  }
}

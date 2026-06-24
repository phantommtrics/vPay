import type { DocumentType, KycStatus, User } from './types';

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'national_id', label: 'National ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'residence_permit', label: 'Residence Permit' },
];

export function getDocumentTypeLabel(value: string | null): string {
  return DOCUMENT_TYPES.find((t) => t.value === value)?.label ?? value ?? '';
}

export function canEditKyc(user: User): boolean {
  return user.kycStatus === 'incomplete' || user.kycStatus === 'rejected';
}

export function isKycPending(user: User): boolean {
  return user.kycStatus === 'pending';
}

export function isKycApproved(user: User): boolean {
  return user.kycStatus === 'approved';
}

export function kycStatusLabel(status: KycStatus): string {
  switch (status) {
    case 'pending':
      return 'Under review';
    case 'approved':
      return 'Verified';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Incomplete';
  }
}

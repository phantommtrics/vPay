import type { ZodError } from 'zod';

const FIELD_LABELS: Record<string, string> = {
  documentType: 'Document type',
  firstName: 'First name',
  lastName: 'Last name',
  phone: 'Phone number',
  dateOfBirth: 'Date of birth',
  address: 'Address',
  city: 'City',
  country: 'Country',
};

export function formatZodError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid request';

  const field = issue.path[0];
  const label = typeof field === 'string' ? (FIELD_LABELS[field] ?? field) : 'Field';

  if (issue.message === 'Required' || issue.code === 'invalid_type') {
    return `${label} is required`;
  }

  return issue.message;
}

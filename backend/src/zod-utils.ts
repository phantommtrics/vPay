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
  email: 'Email',
  fingerprint: 'Device fingerprint',
  deviceName: 'Device name',
  brand: 'Device brand',
  manufacturer: 'Device manufacturer',
  modelName: 'Device model',
  deviceType: 'Device type',
  osName: 'Operating system',
  osVersion: 'OS version',
  appVersion: 'App version',
  hardwareId: 'Device ID',
  topic: 'Topic',
  summary: 'Subject',
  message: 'Message',
};

function formatFieldLabel(path: (string | number)[]): string {
  if (path.length === 0) {
    return 'Field';
  }

  if (path[0] === 'device' && typeof path[1] === 'string') {
    return FIELD_LABELS[path[1]] ?? `Device ${path[1]}`;
  }

  const field = path[0];
  return typeof field === 'string' ? (FIELD_LABELS[field] ?? field) : 'Field';
}

export function formatZodError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid request';

  const label = formatFieldLabel(issue.path);

  if (issue.message === 'Required' || issue.code === 'invalid_type') {
    return `${label} is required`;
  }

  return issue.message.replace(/^String /, `${label} `);
}

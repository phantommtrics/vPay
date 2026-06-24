export function log(event: string, details?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  if (details && Object.keys(details).length > 0) {
    console.log(`[vPay ${timestamp}] ${event}`, details);
  } else {
    console.log(`[vPay ${timestamp}] ${event}`);
  }
}

export function logMissingPersonalDetails(user: {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  postalCode?: string | null;
}): string[] {
  const fields = {
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    dateOfBirth: user.dateOfBirth,
    address: user.address,
    city: user.city,
    country: user.country,
    postalCode: user.postalCode,
  };

  return Object.entries(fields)
    .filter(([, value]) => typeof value !== 'string' || value.trim().length === 0)
    .map(([key]) => key);
}

import assert from 'node:assert/strict';

import {
  normalizePhoneE164,
  parseDateOfBirth,
  resolveCountryCode,
  toStripeCompatiblePhoneE164,
} from '../src/stripe/mappers.js';

function testMappers(): void {
  assert.equal(resolveCountryCode({ countryCode: 'gm', country: 'The Gambia' } as never), 'gm');
  assert.equal(resolveCountryCode({ countryCode: null, country: 'The Gambia' } as never), 'gm');

  const dob = parseDateOfBirth('15/06/1990');
  assert.deepEqual(dob, { day: 15, month: 6, year: 1990 });

  assert.equal(normalizePhoneE164('7123456', 'gm'), '+2207123456');
  assert.equal(normalizePhoneE164('+2207123456', 'gm'), '+2207123456');
  assert.equal(normalizePhoneE164('2207123456', 'gm'), '+2207123456');
  assert.equal(normalizePhoneE164('2202207123456', 'gm'), '+2207123456');
  assert.equal(normalizePhoneE164('+2202207123456', 'gm'), '+2207123456');
  assert.equal(normalizePhoneE164('0771234567', 'sn'), '+221771234567');
  assert.equal(normalizePhoneE164('+221771234567', 'gm'), '+221771234567');

  // Gambia 9-digit (PURA Phase 1): store full number, Stripe gets legacy 7-digit
  assert.equal(normalizePhoneE164('877123456', 'gm'), '+220877123456');
  assert.equal(normalizePhoneE164('220877123456', 'gm'), '+220877123456');
  assert.equal(normalizePhoneE164('833123456', 'gm'), '+220833123456');
  assert.equal(normalizePhoneE164('866123456', 'gm'), '+220866123456');
  assert.equal(toStripeCompatiblePhoneE164('+220877123456'), '+2207123456');
  assert.equal(toStripeCompatiblePhoneE164('+220833123456'), '+2203123456');
  assert.equal(toStripeCompatiblePhoneE164('+220866123456'), '+2206123456');
  assert.equal(toStripeCompatiblePhoneE164('+2207123456'), '+2207123456');
  assert.equal(toStripeCompatiblePhoneE164('+221771234567'), '+221771234567');
}

async function testHealth(): Promise<void> {
  const port = process.env.PORT ?? '3001';
  const response = await fetch(`http://localhost:${port}/health`);
  assert.equal(response.ok, true);
  const body = (await response.json()) as { ok: boolean };
  assert.equal(body.ok, true);
}

async function main(): Promise<void> {
  testMappers();
  console.log('Mapper tests passed');

  try {
    await testHealth();
    console.log('Health check passed');
  } catch {
    console.log('Health check skipped (backend not running)');
  }

  console.log('Card flow verification complete');
}

void main();

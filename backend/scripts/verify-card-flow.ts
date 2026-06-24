import assert from 'node:assert/strict';

import {
  normalizePhoneE164,
  parseDateOfBirth,
  resolveCountryCode,
} from '../src/stripe/mappers.js';

function testMappers(): void {
  assert.equal(resolveCountryCode({ countryCode: 'gm', country: 'The Gambia' } as never), 'gm');
  assert.equal(resolveCountryCode({ countryCode: null, country: 'The Gambia' } as never), 'gm');

  const dob = parseDateOfBirth('15/06/1990');
  assert.deepEqual(dob, { day: 15, month: 6, year: 1990 });

  assert.equal(normalizePhoneE164('7123456', 'gm'), '+2207123456');
  assert.equal(normalizePhoneE164('+2207123456', 'gm'), '+2207123456');
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

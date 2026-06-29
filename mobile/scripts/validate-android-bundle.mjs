#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const bundlePath = process.argv[2];
if (!bundlePath) {
  console.error('Usage: validate-android-bundle.mjs <path-to-index.android.bundle>');
  process.exit(1);
}

const bundle = readFileSync(bundlePath, 'utf8');
const errors = [];

if (bundle.includes('http://10.0.2.2:3001')) {
  errors.push('Bundle contains emulator API URL http://10.0.2.2:3001');
}

if (bundle.includes('http://localhost:3001')) {
  errors.push('Bundle contains localhost API URL http://localhost:3001');
}

if (!process.env.EXPO_PUBLIC_API_URL) {
  errors.push('EXPO_PUBLIC_API_URL was not set during the build');
} else if (!bundle.includes(process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, ''))) {
  errors.push(`Bundle does not contain EXPO_PUBLIC_API_URL (${process.env.EXPO_PUBLIC_API_URL})`);
}

if (errors.length > 0) {
  console.error('Release bundle validation failed:');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log('Release bundle validation passed.');
console.log(`  API URL: ${process.env.EXPO_PUBLIC_API_URL}`);

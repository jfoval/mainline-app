/**
 * Generate a bcrypt hash for your login password.
 *
 * Usage:
 *   node scripts/hash-password.mjs "your-password-here"
 *
 * Copy the output hash and set it as AUTH_PASSWORD_HASH in your .env.local and Vercel env vars.
 */

import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "your-password-here"');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
console.log('\nYour password hash (copy this to AUTH_PASSWORD_HASH):');
console.log(hash);
console.log('');

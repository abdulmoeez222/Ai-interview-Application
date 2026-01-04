import { randomBytes } from 'crypto';

/**
 * Generate a random token for email verification and password reset
 */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate expiration date (default: 24 hours from now)
 */
export function generateTokenExpiration(hours: number = 24): Date {
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + hours);
  return expiration;
}


import crypto from 'crypto';
import { env } from './env';

const OTP_SECRET = env.AUTH_SECRET || 'safepay-verification-secret-key-2026';
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface PendingCaregiverRegistration {
  email: string;
  fullName: string;
  passwordHash: string;
  otpHash: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

export interface ElderInvitationPayload {
  caregiverId: string;
  caregiverName: string;
  elderFullName: string;
  elderEmailOrPhone: string;
  relationship: string;
  approvalThreshold: number;
  dailyCap: number;
  expiresAt: number;
  createdAt: number;
}

/**
 * Generate a cryptographically secure 6-digit numeric verification code
 */
export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hash a verification code with HMAC-SHA256
 */
export function hashVerificationCode(code: string): string {
  return crypto.createHmac('sha256', OTP_SECRET).update(code.trim()).digest('hex');
}

/**
 * Sign an arbitrary object into a base64url tamper-evident token
 */
export function signToken<T extends object>(data: T): string {
  const json = JSON.stringify(data);
  const payloadB64 = Buffer.from(json, 'utf-8').toString('base64url');
  const signature = crypto.createHmac('sha256', OTP_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Verify and decode an HMAC-signed token
 */
export function verifyToken<T extends object>(token: string): T | null {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    const expectedSignature = crypto.createHmac('sha256', OTP_SECRET).update(payloadB64).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const json = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Create a signed ticket for caregiver email verification
 */
export function createVerificationTicket(
  email: string,
  fullName: string,
  passwordHash: string,
  otpCode: string
): string {
  const payload: PendingCaregiverRegistration = {
    email: email.trim().toLowerCase(),
    fullName: fullName.trim(),
    passwordHash,
    otpHash: hashVerificationCode(otpCode),
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    createdAt: Date.now(),
  };
  return signToken(payload);
}

/**
 * Verify an entered OTP code against a signed ticket
 */
export function verifyVerificationTicket(
  ticket: string,
  enteredCode: string
): { success: boolean; error?: string; payload?: PendingCaregiverRegistration; nextTicket?: string } {
  const payload = verifyToken<PendingCaregiverRegistration>(ticket);
  if (!payload) {
    return { success: false, error: 'Invalid or tampered verification ticket. Please sign up again.' };
  }

  if (Date.now() > payload.expiresAt) {
    return { success: false, error: 'Verification code has expired. Please request a new one.' };
  }

  if (payload.attempts >= 5) {
    return { success: false, error: 'Maximum verification attempts exceeded. Please restart registration.' };
  }

  const enteredHash = hashVerificationCode(enteredCode);
  if (enteredHash !== payload.otpHash) {
    // Return an updated ticket with incremented attempts
    const updatedPayload: PendingCaregiverRegistration = {
      ...payload,
      attempts: payload.attempts + 1,
    };
    const nextTicket = signToken(updatedPayload);
    const attemptsLeft = 5 - updatedPayload.attempts;
    return {
      success: false,
      error: `Incorrect verification code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`,
      nextTicket,
    };
  }

  return { success: true, payload };
}

/**
 * Create a signed Elder Invitation Token
 */
export function createInvitationToken(data: Omit<ElderInvitationPayload, 'expiresAt' | 'createdAt'>): string {
  const payload: ElderInvitationPayload = {
    ...data,
    elderEmailOrPhone: data.elderEmailOrPhone.trim().toLowerCase(),
    expiresAt: Date.now() + INVITE_EXPIRY_MS,
    createdAt: Date.now(),
  };
  return signToken(payload);
}

/**
 * Verify an Elder Invitation Token
 */
export function verifyInvitationToken(token: string): { success: boolean; error?: string; payload?: ElderInvitationPayload } {
  const payload = verifyToken<ElderInvitationPayload>(token);
  if (!payload) {
    return { success: false, error: 'Invalid or expired invitation link.' };
  }

  if (Date.now() > payload.expiresAt) {
    return { success: false, error: 'This family invitation link has expired. Please ask your caregiver to send a new invitation.' };
  }

  return { success: true, payload };
}

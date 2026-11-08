import { describe, it, expect } from 'vitest';
import {
  generateVerificationCode,
  createVerificationTicket,
  verifyVerificationTicket,
  createInvitationToken,
  verifyInvitationToken,
} from '@/lib/auth-tokens';

describe('Cryptographic Authentication & Verification Tokens', () => {
  it('generates a 6-digit numeric verification code', () => {
    const code = generateVerificationCode();
    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it('creates and verifies a valid email verification ticket', () => {
    const email = 'caregiver@example.com';
    const fullName = 'Maya Sterling';
    const passwordHash = '$2a$10$abcdefg';
    const code = '123456';

    const ticket = createVerificationTicket(email, fullName, passwordHash, code);
    expect(ticket).toBeDefined();
    expect(ticket.split('.')).toHaveLength(2);

    const result = verifyVerificationTicket(ticket, code);
    expect(result.success).toBe(true);
    expect(result.payload?.email).toBe(email);
    expect(result.payload?.fullName).toBe(fullName);
  });

  it('rejects an incorrect OTP code and decrements remaining attempts', () => {
    const ticket = createVerificationTicket('test@example.com', 'Tester', 'hash', '123456');

    const result = verifyVerificationTicket(ticket, '999999');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Incorrect verification code');
    expect(result.nextTicket).toBeDefined();

    // Verify next ticket has incremented attempts
    const nextResult = verifyVerificationTicket(result.nextTicket!, '888888');
    expect(nextResult.success).toBe(false);
    expect(nextResult.error).toContain('3 attempts remaining');
  });

  it('detects tampered verification tickets', () => {
    const ticket = createVerificationTicket('test@example.com', 'Tester', 'hash', '123456');
    const [payloadB64] = ticket.split('.');
    const tamperedTicket = `${payloadB64}.tampered_signature_here`;

    const result = verifyVerificationTicket(tamperedTicket, '123456');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid or tampered');
  });

  it('creates and verifies an elder invitation token', () => {
    const inviteToken = createInvitationToken({
      caregiverId: '22222222-2222-4222-a222-222222222222',
      caregiverName: 'Maya Sterling-Lin',
      elderFullName: 'Thomas Sterling',
      elderEmailOrPhone: 'thomas@family.com',
      relationship: 'Father',
      approvalThreshold: 100,
      dailyCap: 1000,
    });

    expect(inviteToken).toBeDefined();
    const result = verifyInvitationToken(inviteToken);
    expect(result.success).toBe(true);
    expect(result.payload?.caregiverName).toBe('Maya Sterling-Lin');
    expect(result.payload?.elderFullName).toBe('Thomas Sterling');
    expect(result.payload?.approvalThreshold).toBe(100);
  });

  it('rejects tampered elder invitation tokens', () => {
    const inviteToken = createInvitationToken({
      caregiverId: '22222222-2222-4222-a222-222222222222',
      caregiverName: 'Maya Sterling-Lin',
      elderFullName: 'Thomas Sterling',
      elderEmailOrPhone: 'thomas@family.com',
      relationship: 'Father',
      approvalThreshold: 100,
      dailyCap: 1000,
    });

    const tampered = inviteToken.slice(0, -5) + 'xxxxx';
    const result = verifyInvitationToken(tampered);
    expect(result.success).toBe(false);
  });
});

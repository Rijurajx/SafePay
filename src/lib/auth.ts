import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { prisma } from './db';
import { env } from './env';
import { DemoPersonaKey, DemoPersona, SessionUser, AuthorizationResult } from '@/types';
import { Role } from '@prisma/client';

export const DEMO_PERSONAS: Record<DemoPersonaKey, DemoPersona> = {
  thomas: {
    key: 'thomas',
    id: '11111111-1111-4111-a111-111111111111',
    email: 'thomas@demo.local',
    fullName: 'Thomas Sterling',
    roleDefault: Role.PROTECTED_USER,
    roleDescription: 'Protected Elder',
    isSynthetic: true,
    badge: 'Protected User',
    canApprove: false,
    canView: true,
  },
  maya: {
    key: 'maya',
    id: '22222222-2222-4222-a222-222222222222',
    email: 'maya@demo.local',
    fullName: 'Maya Sterling-Lin',
    roleDefault: Role.CAREGIVER,
    roleDescription: 'Daughter (Full Approval Authority)',
    isSynthetic: true,
    badge: 'Caregiver (Approver)',
    canApprove: true,
    canView: true,
  },
  david: {
    key: 'david',
    id: '33333333-3333-4333-a333-333333333333',
    email: 'david@demo.local',
    fullName: 'David Sterling',
    roleDefault: Role.CAREGIVER,
    roleDescription: 'Son (Co-Caregiver / Approver)',
    isSynthetic: true,
    badge: 'Caregiver (Approver)',
    canApprove: true,
    canView: true,
  },
  sarah: {
    key: 'sarah',
    id: '44444444-4444-4444-a444-444444444444',
    email: 'sarah@demo.local',
    fullName: 'Sarah Sterling',
    roleDefault: Role.CAREGIVER,
    roleDescription: 'Granddaughter (View-Only / Auditor)',
    isSynthetic: true,
    badge: 'Caregiver (View-Only)',
    canApprove: false,
    canView: true,
  },
};

export const SESSION_COOKIE_NAME = 'pmc_session_token';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Sign data with HMAC SHA-256 using AUTH_SECRET
 */
export async function signSessionPayload(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(env.AUTH_SECRET);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload));
  const signature = Buffer.from(signatureBuffer).toString('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${signature}`;
}

export interface SessionPayload {
  userId: string;
  email: string;
  personaKey?: string;
  iat: number;
  exp: number;
}

/**
 * Verify and decode an HMAC SHA-256 signed session token
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return null;

    const payload = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const expectedToken = await signSessionPayload(payload);
    if (token !== expectedToken) return null;

    const parsed = JSON.parse(payload) as SessionPayload;
    if (!parsed.exp || Date.now() > parsed.exp) return null;

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Generate a signed session token for a given user
 */
export async function generateSessionToken(userId: string, email: string, personaKey?: string): Promise<string> {
  const payload = JSON.stringify({
    userId,
    email,
    personaKey,
    iat: Date.now(),
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
  return await signSessionPayload(payload);
}

/**
 * Retrieve the verified authenticated user from the request or cookies
 */
export async function getSessionUser(req?: NextRequest): Promise<SessionUser | null> {
  try {
    let sessionToken: string | undefined;

    // First check request cookies if provided
    if (req) {
      sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    }

    // Otherwise check next/headers cookies store
    if (!sessionToken) {
      try {
        const cookieStore = await cookies();
        sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      } catch {
        // May be outside request context in test runners
      }
    }

    if (!sessionToken) return null;

    const sessionData = await verifySessionToken(sessionToken);
    if (!sessionData?.userId) return null;

    // Verify user exists and is active in database
    const user = await prisma.user.findUnique({
      where: { id: sessionData.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        city: true,
        primaryZipCode: true,
        dateOfBirth: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        preferredNotification: true,
        roleDefault: true,
        isSynthetic: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) return null;

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roleDefault: user.roleDefault,
      isSynthetic: user.isSynthetic,
      phoneNumber: user.phoneNumber,
      city: user.city,
      primaryZipCode: user.primaryZipCode,
      dateOfBirth: user.dateOfBirth,
      emergencyContactName: user.emergencyContactName,
      emergencyContactPhone: user.emergencyContactPhone,
      preferredNotification: user.preferredNotification,
    };
  } catch {
    return null;
  }
}

/**
 * Authenticate as a synthetic demo persona (Thomas, Maya, David, Sarah)
 */
export async function createDemoPersonaToken(personaKey: DemoPersonaKey): Promise<{ user: SessionUser; token: string }> {
  if (process.env.NODE_ENV === 'production' && !env.ENABLE_DEMO_PERSONAS) {
    throw new Error('Demo persona switching is prohibited in production');
  }

  const personaConfig = DEMO_PERSONAS[personaKey];
  if (!personaConfig) {
    throw new Error(`Invalid persona key: ${personaKey}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: personaConfig.id },
  });

  if (!user || !user.isSynthetic) {
    throw new Error('Synthetic persona account not found in database. Run seed first.');
  }

  const token = await generateSessionToken(user.id, user.email, personaKey);

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roleDefault: user.roleDefault,
      isSynthetic: user.isSynthetic,
    },
    token,
  };
}

/**
 * Clear the session cookie
 */
export async function clearSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // handled gracefully
  }
}

/**
 * Strict Role-Independent Authorization
 */
export async function authorizeCaregiverForElder(
  caregiverId: string,
  elderId: string,
  requiredPermission: 'view' | 'approve' | 'manage'
): Promise<AuthorizationResult> {
  if (caregiverId === elderId) {
    return { authorized: false, reason: 'An elder cannot act as their own caregiver' };
  }

  const link = await prisma.familyLink.findFirst({
    where: {
      elderId,
      caregiverId,
      status: 'ACTIVE',
    },
    include: {
      permission: true,
    },
  });

  if (!link) {
    return {
      authorized: false,
      reason: 'No active family relationship exists between this caregiver and the specified elder',
    };
  }

  if (!link.permission) {
    return {
      authorized: false,
      reason: 'No caregiver permissions configured for this family relationship',
    };
  }

  const context = {
    caregiverId,
    elderId,
    familyLinkId: link.id,
    status: link.status,
    canViewTransactions: link.permission.canViewTransactions,
    canApprovePayments: link.permission.canApprovePayments,
    canManageSettings: link.permission.canManageSettings,
  };

  if (requiredPermission === 'view' && !link.permission.canViewTransactions) {
    return { authorized: false, reason: 'Caregiver lacks permission to view transactions', context };
  }

  if (requiredPermission === 'approve' && !link.permission.canApprovePayments) {
    return {
      authorized: false,
      reason: 'Caregiver lacks payment approval authority (View-Only)',
      context,
    };
  }

  if (requiredPermission === 'manage' && !link.permission.canManageSettings) {
    return { authorized: false, reason: 'Caregiver lacks settings management permission', context };
  }

  return { authorized: true, context };
}

export async function authorizeElderDataScope(
  sessionUser: SessionUser,
  targetElderId: string
): Promise<AuthorizationResult> {
  if (sessionUser.id === targetElderId) {
    return { authorized: true };
  }
  return await authorizeCaregiverForElder(sessionUser.id, targetElderId, 'view');
}

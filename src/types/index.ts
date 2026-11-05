import { Role, FamilyLinkStatus } from '@prisma/client';

export type DemoPersonaKey = 'thomas' | 'maya' | 'david' | 'sarah';

export interface DemoPersona {
  key: DemoPersonaKey;
  id: string; // Deterministic synthetic UUID
  email: string;
  fullName: string;
  roleDefault: Role;
  roleDescription: string;
  isSynthetic: true;
  badge: string;
  canApprove: boolean;
  canView: boolean;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  roleDefault: Role;
  isSynthetic: boolean;
}

export interface CaregiverContext {
  caregiverId: string;
  elderId: string;
  familyLinkId: string;
  status: FamilyLinkStatus;
  canViewTransactions: boolean;
  canApprovePayments: boolean;
  canManageSettings: boolean;
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  context?: CaregiverContext;
}

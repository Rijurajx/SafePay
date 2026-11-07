import { Role, FamilyLinkStatus, RiskClassification, PaymentRequestStatus } from '@prisma/client';

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

// Milestone 2: Risk Assessment & Gemini Explainer Types
export type RiskSignalCode =
  | 'EXCEEDS_ABSOLUTE_CAP'
  | 'EXCEEDS_DAILY_CAP'
  | 'EXCEEDS_FAMILY_THRESHOLD'
  | 'NEW_RECIPIENT'
  | 'HIGH_VARIANCE_FROM_MEDIAN'
  | 'UNUSUAL_TIME_OF_DAY'
  | 'RAPID_SPENDING_VELOCITY';

export interface RiskSignal {
  code: RiskSignalCode;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface DeterministicEvaluationResult {
  classification: RiskClassification;
  riskScore: number;
  requiresFamilyApproval: boolean;
  signals: RiskSignal[];
  status: PaymentRequestStatus;
  blockingReason?: string;
  rulesVersion: string;
  baselineVersion?: number;
}

export interface GeminiExplanation {
  headline: string;
  plainEnglishSummary: string;
  merchantAnalysis: string;
  suggestedQuestions: string[];
  seniorMessage: string;
  modelUsed?: string;
  generatedAt?: string;
}

export interface FullRiskAssessmentResponse {
  assessmentId: string;
  paymentRequestId: string;
  classification: RiskClassification;
  riskScore: number;
  requiresFamilyApproval: boolean;
  signals: RiskSignal[];
  explanation: GeminiExplanation;
  status: PaymentRequestStatus;
}

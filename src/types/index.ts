import { Role, FamilyLinkStatus, RiskClassification, PaymentRequestStatus } from '@prisma/client';

export type DemoPersonaKey = 'thomas' | 'maya' | 'david' | 'sarah' | 'senior' | 'caregiver';

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
  phoneNumber?: string | null;
  city?: string | null;
  primaryZipCode?: string | null;
  dateOfBirth?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  preferredNotification?: string | null;
  paypalEmail?: string | null;
  paypalAccountId?: string | null;
  paypalConnectedAt?: string | null;
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
  | 'EXCEEDS_MONTHLY_BUDGET'
  | 'EXCEEDS_FAMILY_THRESHOLD'
  | 'DUPLICATE_PAYMENT_SUSPECTED'
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

// Milestone 3: PayPal Sandbox & Caregiver Approval Types
export interface CreatePayPalOrderInput {
  paymentRequestId: string;
  amount: number;
  currency?: string;
  referenceId: string;
  description: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PayPalOrderResult {
  id: string; // PayPal Order ID (e.g. 3LT10656AU593714L)
  status: string; // CREATED, SAVED, APPROVED, VOIDED, COMPLETED
  approveUrl?: string;
  createRequestId: string;
  rawResponse: Record<string, unknown>;
}

export interface CheckoutCreateOrderResponse {
  success: boolean;
  orderId: string;
  approveUrl?: string;
  status: string;
  reused?: boolean;
}

export interface PayPalCaptureResult {
  captureId: string;
  status: string; // COMPLETED, PENDING, FAILED
  amount: { currency_code: string; value: string };
  rawResponse: Record<string, unknown>;
}

export interface CaregiverDecisionInput {
  decision: 'APPROVED' | 'DECLINED';
  reason?: string;
}

export interface PendingApprovalItem {
  id: string; // approvalRequestId
  paymentRequestId: string;
  elder: {
    id: string;
    fullName: string;
  };
  amount: number;
  currency: string;
  recipient: {
    merchantName: string;
    category: string;
    isTrusted: boolean;
  };
  status: string;
  expiresAt: string;
  riskAssessment?: {
    id: string;
    classification: string;
    riskScore: number;
    signals: RiskSignal[];
    explanation: GeminiExplanation;
  };
  paypalOrderId?: string;
  createdAt: string;
}

export interface ActivityPaymentItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  merchantName: string;
  category: string;
  isTrusted: boolean;
  requiresFamilyApproval: boolean;
  createdAt: string;
  settledAt?: string;
  riskAssessment: {
    score: number;
    classification: string;
    explanation: Record<string, unknown>;
  } | null;
  approval: {
    id: string;
    status: string;
    expiresAt: string;
    respondedAt?: string;
    responses: unknown[];
  } | null;
  paypalOrderId?: string;
}

export interface ActivityAuditLogItem {
  id: string;
  eventType: string;
  actorType: string;
  actorName: string;
  oldState?: string | null;
  newState?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface FamilyActivityData {
  payments: ActivityPaymentItem[];
  auditLogs: ActivityAuditLogItem[];
  spendingToday: number;
  dailyCap: number;
  familyThreshold: number;
}

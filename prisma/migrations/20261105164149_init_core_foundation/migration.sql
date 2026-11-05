-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PROTECTED_USER', 'CAREGIVER');

-- CreateEnum
CREATE TYPE "FamilyLinkStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('INITIATED', 'BLOCKED_BY_POLICY', 'AWAITING_FAMILY', 'APPROVED_FOR_CHECKOUT', 'READY_FOR_CHECKOUT', 'CHECKOUT_IN_PROGRESS', 'SETTLED', 'CAPTURE_PENDING', 'CAPTURE_FAILED', 'DECLINED_BY_FAMILY', 'EXPIRED', 'CANCELLED_BY_USER', 'RECONCILIATION_REQUIRED');

-- CreateEnum
CREATE TYPE "RiskClassification" AS ENUM ('NORMAL', 'UNUSUAL', 'POLICY_VIOLATION');

-- CreateEnum
CREATE TYPE "ApprovalPolicy" AS ENUM ('ANY_ONE');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "PayPalOrderStatus" AS ENUM ('CREATING', 'ORDER_CREATED', 'CREATE_RECONCILIATION_REQUIRED', 'BUYER_APPROVED', 'CAPTURE_IN_PROGRESS', 'COMPLETED', 'PENDING', 'DENIED', 'LOCAL_SECURITY_REJECTED', 'CANCELLED_BY_BUYER', 'CANCELLED_BY_USER', 'RECONCILIATION_REQUIRED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CONVERTED_TO_SETTLED', 'RELEASED');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "DataProvenance" AS ENUM ('PAYPAL_SANDBOX_VERIFIED', 'UNVERIFIED_PENDING', 'SYNTHETIC_DEMO');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM', 'PAYPAL_WEBHOOK', 'RECONCILIATION');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "supabaseId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "fullName" TEXT NOT NULL,
    "roleDefault" "Role" NOT NULL DEFAULT 'PROTECTED_USER',
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyLink" (
    "id" UUID NOT NULL,
    "elderId" UUID NOT NULL,
    "caregiverId" UUID NOT NULL,
    "relationship" TEXT NOT NULL,
    "status" "FamilyLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "consentedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "FamilyLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaregiverPermission" (
    "id" UUID NOT NULL,
    "familyLinkId" UUID NOT NULL,
    "canViewTransactions" BOOLEAN NOT NULL DEFAULT true,
    "canApprovePayments" BOOLEAN NOT NULL DEFAULT false,
    "canManageSettings" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CaregiverPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtectionSettings" (
    "id" UUID NOT NULL,
    "elderId" UUID NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "absoluteTransactionCap" DECIMAL(12,2) NOT NULL,
    "absoluteDailyCap" DECIMAL(12,2) NOT NULL,
    "familyApprovalThreshold" DECIMAL(12,2) NOT NULL,
    "requireFamilyForNewRecipient" BOOLEAN NOT NULL DEFAULT true,
    "requireFamilyForUnusual" BOOLEAN NOT NULL DEFAULT true,
    "approvalTimeoutMinutes" INTEGER NOT NULL DEFAULT 30,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ProtectionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipient" (
    "id" UUID NOT NULL,
    "elderId" UUID NOT NULL,
    "merchantCode" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPaidAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" UUID NOT NULL,
    "elderId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "merchantOrderReference" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'INITIATED',
    "currentRiskAssessmentId" UUID,
    "requiresFamilyApproval" BOOLEAN NOT NULL DEFAULT false,
    "policyVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "baselineVersion" INTEGER,
    "provenance" "DataProvenance" NOT NULL DEFAULT 'UNVERIFIED_PENDING',
    "checkoutExpiresAt" TIMESTAMPTZ,
    "settledAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpendingReservation" (
    "id" UUID NOT NULL,
    "paymentRequestId" UUID NOT NULL,
    "elderId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SpendingReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" UUID NOT NULL,
    "paymentRequestId" UUID NOT NULL,
    "classification" "RiskClassification" NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "signals" JSONB NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "baselineVersion" INTEGER,
    "explanationContext" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" UUID NOT NULL,
    "paymentRequestId" UUID NOT NULL,
    "elderId" UUID NOT NULL,
    "policy" "ApprovalPolicy" NOT NULL DEFAULT 'ANY_ONE',
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "reminder5mSentAt" TIMESTAMPTZ,
    "reminder15mSentAt" TIMESTAMPTZ,
    "respondedById" UUID,
    "respondedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalResponse" (
    "id" UUID NOT NULL,
    "approvalRequestId" UUID NOT NULL,
    "caregiverId" UUID NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayPalOrder" (
    "id" UUID NOT NULL,
    "paymentRequestId" UUID NOT NULL,
    "paypalOrderId" TEXT,
    "paypalCaptureId" TEXT,
    "intent" TEXT NOT NULL DEFAULT 'CAPTURE',
    "status" "PayPalOrderStatus" NOT NULL DEFAULT 'CREATING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createRequestId" UUID NOT NULL,
    "captureRequestId" UUID NOT NULL,
    "captureSubmissionCommittedAt" TIMESTAMPTZ,
    "captureFirstAttemptAt" TIMESTAMPTZ,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PayPalOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpendingBaseline" (
    "id" UUID NOT NULL,
    "elderId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "medianTransaction" DECIMAL(12,2) NOT NULL,
    "madTransaction" DECIMAL(12,2) NOT NULL,
    "usualStartHour" INTEGER NOT NULL DEFAULT 8,
    "usualEndHour" INTEGER NOT NULL DEFAULT 22,
    "monthlyAverage" DECIMAL(12,2) NOT NULL,
    "recipientStatistics" JSONB NOT NULL,
    "provenance" "DataProvenance" NOT NULL DEFAULT 'PAYPAL_SANDBOX_VERIFIED',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SpendingBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "paymentRequestId" UUID,
    "actorId" UUID,
    "actorType" "AuditActorType" NOT NULL DEFAULT 'USER',
    "eventType" TEXT NOT NULL,
    "oldState" TEXT,
    "newState" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayPalWebhookEvent" (
    "id" UUID NOT NULL,
    "paypalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "paypalOrderId" TEXT,
    "paypalCaptureId" TEXT,
    "deliveryCount" INTEGER NOT NULL DEFAULT 1,
    "processingStatus" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "leaseExpiresAt" TIMESTAMPTZ,
    "nextRetryAt" TIMESTAMPTZ,
    "lastError" TEXT,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ,

    CONSTRAINT "PayPalWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseId_key" ON "User"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "FamilyLink_caregiverId_status_idx" ON "FamilyLink"("caregiverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyLink_elderId_caregiverId_key" ON "FamilyLink"("elderId", "caregiverId");

-- CreateIndex
CREATE UNIQUE INDEX "CaregiverPermission_familyLinkId_key" ON "CaregiverPermission"("familyLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtectionSettings_elderId_key" ON "ProtectionSettings"("elderId");

-- CreateIndex
CREATE INDEX "Recipient_elderId_idx" ON "Recipient"("elderId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipient_id_elderId_key" ON "Recipient"("id", "elderId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipient_elderId_merchantCode_key" ON "Recipient"("elderId", "merchantCode");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_currentRiskAssessmentId_key" ON "PaymentRequest"("currentRiskAssessmentId");

-- CreateIndex
CREATE INDEX "PaymentRequest_elderId_createdAt_idx" ON "PaymentRequest"("elderId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PaymentRequest_status_idx" ON "PaymentRequest"("status");

-- CreateIndex
CREATE INDEX "PaymentRequest_elderId_status_settledAt_idx" ON "PaymentRequest"("elderId", "status", "settledAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_id_elderId_key" ON "PaymentRequest"("id", "elderId");

-- CreateIndex
CREATE UNIQUE INDEX "SpendingReservation_paymentRequestId_key" ON "SpendingReservation"("paymentRequestId");

-- CreateIndex
CREATE INDEX "SpendingReservation_elderId_status_idx" ON "SpendingReservation"("elderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SpendingReservation_paymentRequestId_elderId_key" ON "SpendingReservation"("paymentRequestId", "elderId");

-- CreateIndex
CREATE INDEX "RiskAssessment_paymentRequestId_createdAt_idx" ON "RiskAssessment"("paymentRequestId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_id_paymentRequestId_key" ON "RiskAssessment"("id", "paymentRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_paymentRequestId_key" ON "ApprovalRequest"("paymentRequestId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_expiresAt_idx" ON "ApprovalRequest"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_elderId_status_idx" ON "ApprovalRequest"("elderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_paymentRequestId_elderId_key" ON "ApprovalRequest"("paymentRequestId", "elderId");

-- CreateIndex
CREATE INDEX "ApprovalResponse_caregiverId_idx" ON "ApprovalResponse"("caregiverId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalResponse_approvalRequestId_caregiverId_key" ON "ApprovalResponse"("approvalRequestId", "caregiverId");

-- CreateIndex
CREATE UNIQUE INDEX "PayPalOrder_paymentRequestId_key" ON "PayPalOrder"("paymentRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "PayPalOrder_paypalOrderId_key" ON "PayPalOrder"("paypalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PayPalOrder_paypalCaptureId_key" ON "PayPalOrder"("paypalCaptureId");

-- CreateIndex
CREATE UNIQUE INDEX "PayPalOrder_createRequestId_key" ON "PayPalOrder"("createRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "PayPalOrder_captureRequestId_key" ON "PayPalOrder"("captureRequestId");

-- CreateIndex
CREATE INDEX "PayPalOrder_paypalOrderId_idx" ON "PayPalOrder"("paypalOrderId");

-- CreateIndex
CREATE INDEX "PayPalOrder_status_idx" ON "PayPalOrder"("status");

-- CreateIndex
CREATE INDEX "SpendingBaseline_elderId_version_idx" ON "SpendingBaseline"("elderId", "version" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SpendingBaseline_elderId_version_key" ON "SpendingBaseline"("elderId", "version");

-- CreateIndex
CREATE INDEX "AuditEvent_paymentRequestId_createdAt_idx" ON "AuditEvent"("paymentRequestId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PayPalWebhookEvent_paypalEventId_key" ON "PayPalWebhookEvent"("paypalEventId");

-- CreateIndex
CREATE INDEX "PayPalWebhookEvent_paypalOrderId_idx" ON "PayPalWebhookEvent"("paypalOrderId");

-- CreateIndex
CREATE INDEX "PayPalWebhookEvent_processingStatus_nextRetryAt_idx" ON "PayPalWebhookEvent"("processingStatus", "nextRetryAt");

-- AddForeignKey
ALTER TABLE "FamilyLink" ADD CONSTRAINT "FamilyLink_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyLink" ADD CONSTRAINT "FamilyLink_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverPermission" ADD CONSTRAINT "CaregiverPermission_familyLinkId_fkey" FOREIGN KEY ("familyLinkId") REFERENCES "FamilyLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectionSettings" ADD CONSTRAINT "ProtectionSettings_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_recipientId_elderId_fkey" FOREIGN KEY ("recipientId", "elderId") REFERENCES "Recipient"("id", "elderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_currentRiskAssessmentId_fkey" FOREIGN KEY ("currentRiskAssessmentId") REFERENCES "RiskAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendingReservation" ADD CONSTRAINT "SpendingReservation_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendingReservation" ADD CONSTRAINT "SpendingReservation_paymentRequestId_elderId_fkey" FOREIGN KEY ("paymentRequestId", "elderId") REFERENCES "PaymentRequest"("id", "elderId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_paymentRequestId_elderId_fkey" FOREIGN KEY ("paymentRequestId", "elderId") REFERENCES "PaymentRequest"("id", "elderId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalResponse" ADD CONSTRAINT "ApprovalResponse_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalResponse" ADD CONSTRAINT "ApprovalResponse_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayPalOrder" ADD CONSTRAINT "PayPalOrder_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendingBaseline" ADD CONSTRAINT "SpendingBaseline_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

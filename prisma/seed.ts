import { PrismaClient, Role, FamilyLinkStatus, DataProvenance } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const DEMO_PASSWORDS = 'DemoPassword123!';

export const SEEDED_PERSONAS = {
  thomas: {
    id: '11111111-1111-4111-a111-111111111111',
    email: 'thomas@demo.local',
    fullName: 'Thomas Sterling',
    roleDefault: Role.PROTECTED_USER,
    isSynthetic: true,
  },
  maya: {
    id: '22222222-2222-4222-a222-222222222222',
    email: 'maya@demo.local',
    fullName: 'Maya Sterling-Lin',
    roleDefault: Role.CAREGIVER,
    isSynthetic: true,
  },
  david: {
    id: '33333333-3333-4333-a333-333333333333',
    email: 'david@demo.local',
    fullName: 'David Sterling',
    roleDefault: Role.CAREGIVER,
    isSynthetic: true,
  },
  sarah: {
    id: '44444444-4444-4444-a444-444444444444',
    email: 'sarah@demo.local',
    fullName: 'Sarah Sterling',
    roleDefault: Role.CAREGIVER,
    isSynthetic: true,
  },
} as const;

async function main() {
  console.log('🌱 Seeding Protected Money Companion database...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORDS, 10);

  // 1. Seed or update Users
  for (const persona of Object.values(SEEDED_PERSONAS)) {
    await prisma.user.upsert({
      where: { id: persona.id },
      update: {
        email: persona.email,
        fullName: persona.fullName,
        roleDefault: persona.roleDefault,
        isSynthetic: true,
        isActive: true,
        passwordHash,
      },
      create: {
        id: persona.id,
        supabaseId: `mock-supabase-${persona.id}`,
        email: persona.email,
        fullName: persona.fullName,
        roleDefault: persona.roleDefault,
        isSynthetic: true,
        isActive: true,
        passwordHash,
      },
    });
  }

  // 2. Seed Protection Settings for Thomas
  await prisma.protectionSettings.upsert({
    where: { elderId: SEEDED_PERSONAS.thomas.id },
    update: {
      absoluteTransactionCap: 1500.0,
      absoluteDailyCap: 2500.0,
      familyApprovalThreshold: 100.0,
      requireFamilyForNewRecipient: true,
      requireFamilyForUnusual: true,
      approvalTimeoutMinutes: 30,
      currency: 'USD',
      version: 1,
    },
    create: {
      elderId: SEEDED_PERSONAS.thomas.id,
      absoluteTransactionCap: 1500.0,
      absoluteDailyCap: 2500.0,
      familyApprovalThreshold: 100.0,
      requireFamilyForNewRecipient: true,
      requireFamilyForUnusual: true,
      approvalTimeoutMinutes: 30,
      currency: 'USD',
      version: 1,
    },
  });

  // 3. Seed Family Links & Caregiver Permissions
  const links = [
    {
      caregiverId: SEEDED_PERSONAS.maya.id,
      relationship: 'Daughter (Primary Caregiver)',
      canView: true,
      canApprove: true,
      canManage: true,
    },
    {
      caregiverId: SEEDED_PERSONAS.david.id,
      relationship: 'Son (Co-Caregiver)',
      canView: true,
      canApprove: true,
      canManage: false,
    },
    {
      caregiverId: SEEDED_PERSONAS.sarah.id,
      relationship: 'Granddaughter (View-Only)',
      canView: true,
      canApprove: false, // Strict view-only requirement
      canManage: false,
    },
  ];

  for (const link of links) {
    const familyLink = await prisma.familyLink.upsert({
      where: {
        elderId_caregiverId: {
          elderId: SEEDED_PERSONAS.thomas.id,
          caregiverId: link.caregiverId,
        },
      },
      update: {
        relationship: link.relationship,
        status: FamilyLinkStatus.ACTIVE,
      },
      create: {
        elderId: SEEDED_PERSONAS.thomas.id,
        caregiverId: link.caregiverId,
        relationship: link.relationship,
        status: FamilyLinkStatus.ACTIVE,
      },
    });

    await prisma.caregiverPermission.upsert({
      where: { familyLinkId: familyLink.id },
      update: {
        canViewTransactions: link.canView,
        canApprovePayments: link.canApprove,
        canManageSettings: link.canManage,
      },
      create: {
        familyLinkId: familyLink.id,
        canViewTransactions: link.canView,
        canApprovePayments: link.canApprove,
        canManageSettings: link.canManage,
      },
    });
  }

  // 4. Seed Known Recipient for Thomas
  await prisma.recipient.upsert({
    where: {
      elderId_merchantCode: {
        elderId: SEEDED_PERSONAS.thomas.id,
        merchantCode: 'DAILY_CHRONICLE',
      },
    },
    update: {
      merchantName: 'The Daily Chronicle',
      category: 'Subscriptions',
      isTrusted: true,
    },
    create: {
      elderId: SEEDED_PERSONAS.thomas.id,
      merchantCode: 'DAILY_CHRONICLE',
      merchantName: 'The Daily Chronicle',
      category: 'Subscriptions',
      isTrusted: true,
    },
  });

  // 5. Seed Synthetic Baseline (Version 1)
  await prisma.spendingBaseline.upsert({
    where: {
      elderId_version: {
        elderId: SEEDED_PERSONAS.thomas.id,
        version: 1,
      },
    },
    update: {
      sampleSize: 22,
      medianTransaction: 24.5,
      madTransaction: 6.5,
      usualStartHour: 8,
      usualEndHour: 21,
      monthlyAverage: 380.0,
      recipientStatistics: {
        familiarMerchants: ['DAILY_CHRONICLE', 'CORNER_PHARMACY', 'GREEN_GROCERY'],
        categoryAverages: {
          Subscriptions: 12.0,
          Groceries: 38.5,
          Pharmacy: 22.0,
        },
      },
      provenance: DataProvenance.SYNTHETIC_DEMO,
    },
    create: {
      elderId: SEEDED_PERSONAS.thomas.id,
      version: 1,
      sampleSize: 22,
      medianTransaction: 24.5,
      madTransaction: 6.5,
      usualStartHour: 8,
      usualEndHour: 21,
      monthlyAverage: 380.0,
      recipientStatistics: {
        familiarMerchants: ['DAILY_CHRONICLE', 'CORNER_PHARMACY', 'GREEN_GROCERY'],
        categoryAverages: {
          Subscriptions: 12.0,
          Groceries: 38.5,
          Pharmacy: 22.0,
        },
      },
      provenance: DataProvenance.SYNTHETIC_DEMO,
    },
  });

  console.log('✅ Seed complete: Thomas, Maya, David, Sarah, settings, recipient, and baseline.');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


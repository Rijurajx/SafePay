import { PrismaClient } from '@prisma/client';
import { createAdminClient } from '../src/lib/supabase/admin';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log('🧹 Initiating complete database wipe...\n');

  // 1. Wipe all PostgreSQL application tables in order
  console.log('1. Truncating all PostgreSQL tables...');
  const tableNames = [
    'ApprovalResponse',
    'ApprovalRequest',
    'PayPalWebhookEvent',
    'PayPalOrder',
    'SpendingReservation',
    'RiskAssessment',
    'PaymentRequest',
    'Recipient',
    'CaregiverPermission',
    'ProtectionSettings',
    'SpendingBaseline',
    'FamilyLink',
    'AuditEvent',
    'User',
  ];

  try {
    // Truncate all tables with CASCADE
    const tableListStr = tableNames.map((t) => `"${t}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableListStr} CASCADE;`);
    console.log(`✅ Successfully truncated all ${tableNames.length} tables:`);
    for (const name of tableNames) {
      console.log(`   - ${name}`);
    }
  } catch (err) {
    console.warn('Direct CASCADE truncate failed, falling back to sequential deleteMany...', err);
    await prisma.approvalResponse.deleteMany();
    await prisma.approvalRequest.deleteMany();
    await prisma.payPalWebhookEvent.deleteMany();
    await prisma.payPalOrder.deleteMany();
    await prisma.spendingReservation.deleteMany();
    await prisma.riskAssessment.deleteMany();
    await prisma.paymentRequest.deleteMany();
    await prisma.recipient.deleteMany();
    await prisma.caregiverPermission.deleteMany();
    await prisma.protectionSettings.deleteMany();
    await prisma.spendingBaseline.deleteMany();
    await prisma.familyLink.deleteMany();
    await prisma.auditEvent.deleteMany();
    await prisma.user.deleteMany();
    console.log('✅ Deleted all records sequentially.');
  }

  // 2. Wipe all Supabase Auth users
  console.log('\n2. Cleaning up Supabase Auth users...');
  try {
    const adminSb = createAdminClient();
    const { data, error } = await adminSb.auth.admin.listUsers({ perPage: 1000 });
    if (error) {
      console.warn('⚠️ Could not list Supabase Auth users:', error.message);
    } else {
      const users = data?.users || [];
      console.log(`Found ${users.length} user(s) in Supabase Auth.`);
      for (const u of users) {
        await adminSb.auth.admin.deleteUser(u.id);
        console.log(`   - Deleted Supabase Auth user: ${u.email} (${u.id})`);
      }
      console.log('✅ Supabase Auth completely cleared.');
    }
  } catch (authErr) {
    console.warn('Notice: Supabase Auth wipe skipped or failed:', authErr);
  }

  // 3. Verify counts
  console.log('\n3. Verifying remaining counts in PostgreSQL:');
  const userCount = await prisma.user.count();
  const paymentCount = await prisma.paymentRequest.count();
  const linkCount = await prisma.familyLink.count();
  const approvalCount = await prisma.approvalRequest.count();

  console.log(`   - Users: ${userCount}`);
  console.log(`   - FamilyLinks: ${linkCount}`);
  console.log(`   - PaymentRequests: ${paymentCount}`);
  console.log(`   - ApprovalRequests: ${approvalCount}`);

  if (userCount === 0 && paymentCount === 0 && linkCount === 0 && approvalCount === 0) {
    console.log('\n🎉 ALL DATABASE TABLES HAVE BEEN COMPLETELY WIPED! Ready for fresh testing.');
  } else {
    console.warn('\n⚠️ Some records remain. Please review.');
  }
}

main()
  .catch((e) => {
    console.error('❌ Wipe failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

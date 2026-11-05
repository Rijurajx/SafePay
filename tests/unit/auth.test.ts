import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { authorizeCaregiverForElder, authorizeElderDataScope, DEMO_PERSONAS } from '@/lib/auth';
import { Role } from '@prisma/client';

describe('Milestone 1: Role-Independent Caregiver Authorization', () => {
  const thomasId = DEMO_PERSONAS.thomas.id;
  const mayaId = DEMO_PERSONAS.maya.id;
  const davidId = DEMO_PERSONAS.david.id;
  const sarahId = DEMO_PERSONAS.sarah.id;
  const unlinkedCaregiverId = '99999999-9999-4999-a999-999999999999';

  beforeAll(async () => {
    // Ensure database connection
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('authorizes Maya (Primary Caregiver) for payment approvals and settings', async () => {
    const viewResult = await authorizeCaregiverForElder(mayaId, thomasId, 'view');
    expect(viewResult.authorized).toBe(true);

    const approveResult = await authorizeCaregiverForElder(mayaId, thomasId, 'approve');
    expect(approveResult.authorized).toBe(true);
    expect(approveResult.context?.canApprovePayments).toBe(true);

    const manageResult = await authorizeCaregiverForElder(mayaId, thomasId, 'manage');
    expect(manageResult.authorized).toBe(true);
  });

  it('authorizes David (Co-Caregiver) for payment approvals but not settings management', async () => {
    const viewResult = await authorizeCaregiverForElder(davidId, thomasId, 'view');
    expect(viewResult.authorized).toBe(true);

    const approveResult = await authorizeCaregiverForElder(davidId, thomasId, 'approve');
    expect(approveResult.authorized).toBe(true);
    expect(approveResult.context?.canApprovePayments).toBe(true);

    const manageResult = await authorizeCaregiverForElder(davidId, thomasId, 'manage');
    expect(manageResult.authorized).toBe(false);
    expect(manageResult.reason).toContain('lacks settings management permission');
  });

  it('permits Sarah to view transactions but strictly blocks payment approvals (View-Only)', async () => {
    // View permission must succeed
    const viewResult = await authorizeCaregiverForElder(sarahId, thomasId, 'view');
    expect(viewResult.authorized).toBe(true);
    expect(viewResult.context?.canViewTransactions).toBe(true);

    // Approval permission MUST be denied server-side
    const approveResult = await authorizeCaregiverForElder(sarahId, thomasId, 'approve');
    expect(approveResult.authorized).toBe(false);
    expect(approveResult.reason).toContain('lacks payment approval authority (View-Only)');
    expect(approveResult.context?.canApprovePayments).toBe(false);
  });

  it('strictly rejects access for unlinked caregivers', async () => {
    const result = await authorizeCaregiverForElder(unlinkedCaregiverId, thomasId, 'view');
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('No active family relationship exists');
  });

  it('rejects an elder acting as their own caregiver', async () => {
    const result = await authorizeCaregiverForElder(thomasId, thomasId, 'approve');
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('An elder cannot act as their own caregiver');
  });

  it('enforces elder data scope isolation', async () => {
    const thomasSession = {
      id: thomasId,
      email: DEMO_PERSONAS.thomas.email,
      fullName: DEMO_PERSONAS.thomas.fullName,
      roleDefault: Role.PROTECTED_USER,
      isSynthetic: true,
    };

    const mayaSession = {
      id: mayaId,
      email: DEMO_PERSONAS.maya.email,
      fullName: DEMO_PERSONAS.maya.fullName,
      roleDefault: Role.CAREGIVER,
      isSynthetic: true,
    };

    const strangerSession = {
      id: unlinkedCaregiverId,
      email: 'stranger@demo.local',
      fullName: 'Stranger User',
      roleDefault: Role.CAREGIVER,
      isSynthetic: true,
    };

    // Thomas accessing Thomas: Granted
    const thomasSelf = await authorizeElderDataScope(thomasSession, thomasId);
    expect(thomasSelf.authorized).toBe(true);

    // Maya (linked caregiver) accessing Thomas: Granted
    const mayaAccess = await authorizeElderDataScope(mayaSession, thomasId);
    expect(mayaAccess.authorized).toBe(true);

    // Stranger accessing Thomas: Denied
    const strangerAccess = await authorizeElderDataScope(strangerSession, thomasId);
    expect(strangerAccess.authorized).toBe(false);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { DEMO_PERSONAS, createDemoPersonaToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { POST as handleDemoSwitch } from '@/app/api/auth/demo-switch/route';
import { GET as handleCaregivers } from '@/app/api/family/caregivers/route';
import { POST as handleTestAuthorize } from '@/app/api/approvals/test-authorize/route';
import { NextRequest } from 'next/server';

describe('Milestone 1: API Route Authentication & Authorization Integration', () => {
  const thomasId = DEMO_PERSONAS.thomas.id;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects demo switch for invalid persona keys', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/demo-switch', {
      method: 'POST',
      body: JSON.stringify({ persona: 'hacker' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handleDemoSwitch(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid persona selected');
  });

  it('authenticates Thomas via demo-switch and sets session cookie', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/demo-switch', {
      method: 'POST',
      body: JSON.stringify({ persona: 'thomas' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handleDemoSwitch(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.user.id).toBe(thomasId);
    expect(json.user.email).toBe(DEMO_PERSONAS.thomas.email);

    // Verify Set-Cookie header is returned with the signed token
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain(SESSION_COOKIE_NAME);
  });

  it('verifies that unauthenticated request to /api/family/caregivers returns 401', async () => {
    const req = new NextRequest(`http://localhost:3000/api/family/caregivers?elderId=${thomasId}`, {
      method: 'GET',
    });

    const res = await handleCaregivers(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Authentication required');
  });

  it('verifies Sarah is rejected server-side with HTTP 403 when attempting approval', async () => {
    const { token } = await createDemoPersonaToken('sarah');

    const req = new NextRequest('http://localhost:3000/api/approvals/test-authorize', {
      method: 'POST',
      body: JSON.stringify({ elderId: thomasId }),
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await handleTestAuthorize(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.authorized).toBe(false);
    expect(json.reason).toContain('lacks payment approval authority (View-Only)');
  });

  it('verifies Maya is authorized with HTTP 200 when requesting approval authority', async () => {
    const { token } = await createDemoPersonaToken('maya');

    const req = new NextRequest('http://localhost:3000/api/approvals/test-authorize', {
      method: 'POST',
      body: JSON.stringify({ elderId: thomasId }),
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await handleTestAuthorize(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.authorized).toBe(true);
    expect(json.context.canApprovePayments).toBe(true);
  });

  it('verifies David is authorized with HTTP 200 when requesting approval authority', async () => {
    const { token } = await createDemoPersonaToken('david');

    const req = new NextRequest('http://localhost:3000/api/approvals/test-authorize', {
      method: 'POST',
      body: JSON.stringify({ elderId: thomasId }),
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await handleTestAuthorize(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.authorized).toBe(true);
    expect(json.context.canApprovePayments).toBe(true);
  });

  it('allows Maya to query caregivers for Thomas and verifies exact permissions', async () => {
    const { token } = await createDemoPersonaToken('maya');

    const req = new NextRequest(`http://localhost:3000/api/family/caregivers?elderId=${thomasId}`, {
      method: 'GET',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await handleCaregivers(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.elderId).toBe(thomasId);
    expect(json.caregivers).toHaveLength(3);

    const sarahRecord = json.caregivers.find((c: any) => c.caregiverId === DEMO_PERSONAS.sarah.id);
    expect(sarahRecord).toBeDefined();
    expect(sarahRecord.permissions.canViewTransactions).toBe(true);
    expect(sarahRecord.permissions.canApprovePayments).toBe(false); // Sarah view-only

    const mayaRecord = json.caregivers.find((c: any) => c.caregiverId === DEMO_PERSONAS.maya.id);
    expect(mayaRecord).toBeDefined();
    expect(mayaRecord.permissions.canApprovePayments).toBe(true);
  });

  it('rejects caregiver from accessing unlinked elder data', async () => {
    const { token } = await createDemoPersonaToken('maya');
    const randomElderId = '55555555-5555-5555-a555-555555555555';

    const req = new NextRequest(`http://localhost:3000/api/family/caregivers?elderId=${randomElderId}`, {
      method: 'GET',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await handleCaregivers(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Forbidden');
  });
});

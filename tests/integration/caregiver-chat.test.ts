import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { DEMO_PERSONAS, createDemoPersonaToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { POST as handleCaregiverChat } from '@/app/api/ai/caregiver-chat/route';
import { NextRequest } from 'next/server';

describe('Caregiver AI Chat Assistant Integration', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/ai/caregiver-chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handleCaregiverChat(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Authentication required');
  });

  it('rejects requests without a message string with 400', async () => {
    const { token } = await createDemoPersonaToken('maya');
    const req = new NextRequest('http://localhost:3000/api/ai/caregiver-chat', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await handleCaregiverChat(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Message is required');
  });

  it('allows Maya to ask about the pending $489 Tech Care charge and receives risk analysis', async () => {
    const { token } = await createDemoPersonaToken('maya');
    const req = new NextRequest('http://localhost:3000/api/ai/caregiver-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Why was the $489 Tech Care charge flagged for Dad?',
      }),
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await handleCaregiverChat(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toBeDefined();
    expect(json.reply).toContain('Global PC Tech Care LLC');
    expect(json.reply).toContain('$489.00');
    expect(json.suggestedActions.length).toBeGreaterThan(0);
  });

  it('drafts a respectful, dignified SMS to Dad when requested by David', async () => {
    const { token } = await createDemoPersonaToken('david');
    const req = new NextRequest('http://localhost:3000/api/ai/caregiver-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Draft a gentle text to Dad about the paused $489 charge',
      }),
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await handleCaregiverChat(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.draftMessage).toBeDefined();
    expect(json.draftMessage).toContain('Hi Dad!');
    expect(json.draftMessage).toContain('489');
  });

  it('allows Sarah (view-only caregiver) to query spending summary', async () => {
    const { token } = await createDemoPersonaToken('sarah');
    const req = new NextRequest('http://localhost:3000/api/ai/caregiver-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Summarize Dad’s spending this month',
      }),
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await handleCaregiverChat(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toContain('Summary');
    expect(json.reply).toContain('Walgreens');
  });

  it('strictly enforces account isolation: rejects caregiver querying unlinked elder with 403', async () => {
    const { token } = await createDemoPersonaToken('maya');
    const fakeElderId = '00000000-0000-0000-0000-000000000099';
    const req = new NextRequest('http://localhost:3000/api/ai/caregiver-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Show me all transactions',
        elderId: fakeElderId,
      }),
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await handleCaregiverChat(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Strict account isolation');
  });
});

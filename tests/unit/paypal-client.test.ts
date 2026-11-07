import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPayPalAccessToken,
  createPayPalOrder,
  capturePayPalOrder,
  verifyPayPalWebhookSignature,
} from '@/lib/paypal/client';

describe('Milestone 3: PayPal Sandbox Client Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates synthetic demo token when in offline testing mode', async () => {
    const originalClientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
    process.env.PAYPAL_SANDBOX_CLIENT_ID = 'placeholder';

    const token = await getPayPalAccessToken();
    expect(token).toMatch(/^synthetic-demo-token-/);

    process.env.PAYPAL_SANDBOX_CLIENT_ID = originalClientId;
  });

  it('creates synthetic PayPal order in demo offline mode with valid UUID idempotency key', async () => {
    const originalClientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
    process.env.PAYPAL_SANDBOX_CLIENT_ID = 'demo-client-id';

    const result = await createPayPalOrder({
      paymentRequestId: '11111111-2222-3333-4444-555555555555',
      amount: 49.99,
      referenceId: 'TEST-ORDER-123',
      description: 'Test purchase',
    });

    expect(result.id).toMatch(/^DEMO-ORDER-/);
    expect(result.status).toBe('CREATED');
    expect(result.approveUrl).toContain('https://sandbox.paypal.com/checkoutnow?token=DEMO-ORDER-');
    expect(result.createRequestId).toBeDefined();

    process.env.PAYPAL_SANDBOX_CLIENT_ID = originalClientId;
  });

  it('captures synthetic PayPal order in demo offline mode', async () => {
    const result = await capturePayPalOrder('DEMO-ORDER-12345');
    expect(result.status).toBe('COMPLETED');
    expect(result.captureId).toMatch(/^DEMO-CAP-/);
  });

  it('verifies webhook signature returns true in demo placeholder environment', async () => {
    const verified = await verifyPayPalWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'trans-123',
      transmissionSig: 'sig-123',
      transmissionTime: '2026-11-07T12:00:00Z',
      webhookId: 'placeholder_webhook_id',
      webhookEvent: { id: 'WH-123', event_type: 'CHECKOUT.ORDER.APPROVED' },
    });

    expect(verified).toBe(true);
  });
});


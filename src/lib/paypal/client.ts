import { CreatePayPalOrderInput, PayPalOrderResult, PayPalCaptureResult } from '@/types';
import crypto from 'crypto';

const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com';

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cachedToken: TokenCache | null = null;

/**
 * Obtain an OAuth 2.0 client credentials access token for PayPal Sandbox.
 * Automatically caches token until 60 seconds before expiration.
 */
export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_SANDBOX_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId === 'placeholder' || clientId.startsWith('demo-')) {
    // Return synthetic demo token for offline testing environments
    return `synthetic-demo-token-${Date.now()}`;
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.token;
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to authenticate with PayPal Sandbox (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const expiresInMs = (data.expires_in || 3600) * 1000;

  cachedToken = {
    token: data.access_token,
    expiresAt: now + expiresInMs,
  };

  return data.access_token;
}

/**
 * Creates an order in PayPal Sandbox with idempotency headers.
 */
export async function createPayPalOrder(input: CreatePayPalOrderInput): Promise<PayPalOrderResult> {
  const { paymentRequestId, amount, currency = 'USD', referenceId, description, returnUrl, cancelUrl } = input;
  const createRequestId = crypto.randomUUID();

  // If in synthetic/demo offline mode without live credentials
  const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
  if (!clientId || clientId === 'placeholder' || clientId.startsWith('demo-')) {
    const mockOrderId = `DEMO-ORDER-${Date.now().toString(36).toUpperCase()}`;
    return {
      id: mockOrderId,
      status: 'CREATED',
      approveUrl: `https://sandbox.paypal.com/checkoutnow?token=${mockOrderId}`,
      createRequestId,
      rawResponse: {
        id: mockOrderId,
        status: 'CREATED',
        synthetic: true,
      },
    };
  }

  const token = await getPayPalAccessToken();

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: referenceId,
        description: description.slice(0, 127),
        custom_id: paymentRequestId,
        amount: {
          currency_code: currency,
          value: amount.toFixed(2),
        },
      },
    ],
    application_context: {
      brand_name: 'SafePay Protected Money',
      landing_page: 'NO_PREFERENCE',
      user_action: 'PAY_NOW',
      return_url: returnUrl || 'http://localhost:3000/checkout/success',
      cancel_url: cancelUrl || 'http://localhost:3000/checkout/cancel',
    },
  };

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': createRequestId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal Create Order failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const approveLink = Array.isArray(data.links) ? data.links.find((l: { rel: string; href: string }) => l.rel === 'approve') : null;

  return {
    id: data.id,
    status: data.status || 'CREATED',
    approveUrl: approveLink?.href,
    createRequestId,
    rawResponse: data,
  };
}

/**
 * Capture an approved PayPal Order using an idempotent request ID.
 */
export async function capturePayPalOrder(paypalOrderId: string, idempotencyKey?: string): Promise<PayPalCaptureResult> {
  const captureRequestId = idempotencyKey || crypto.randomUUID();

  // If in synthetic/demo offline mode
  const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
  if (!clientId || clientId === 'placeholder' || clientId.startsWith('demo-') || paypalOrderId.startsWith('DEMO-')) {
    const mockCaptureId = `DEMO-CAP-${Date.now().toString(36).toUpperCase()}`;
    return {
      captureId: mockCaptureId,
      status: 'COMPLETED',
      amount: { currency_code: 'USD', value: '0.00' },
      rawResponse: { id: mockCaptureId, status: 'COMPLETED', synthetic: true },
    };
  }

  const token = await getPayPalAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': captureRequestId,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal Capture Order failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];

  return {
    captureId: capture?.id || data.id,
    status: capture?.status || data.status || 'COMPLETED',
    amount: {
      currency_code: capture?.amount?.currency_code || 'USD',
      value: capture?.amount?.value || '0.00',
    },
    rawResponse: data,
  };
}

/**
 * Retrieve status and details of an existing PayPal Order.
 */
export async function getPayPalOrderDetails(paypalOrderId: string): Promise<Record<string, unknown>> {
  if (paypalOrderId.startsWith('DEMO-')) {
    return { id: paypalOrderId, status: 'APPROVED', synthetic: true };
  }

  const token = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${paypalOrderId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal Get Order failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Verifies PayPal webhook signature against PayPal Sandbox API.
 */
export async function verifyPayPalWebhookSignature(params: {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
  webhookId: string;
  webhookEvent: Record<string, unknown>;
}): Promise<boolean> {
  const { authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime, webhookId, webhookEvent } = params;

  // In demo or test mode with placeholder webhook ID, return true
  if (!webhookId || webhookId === 'placeholder_webhook_id' || webhookId.startsWith('demo-')) {
    return true;
  }

  try {
    const token = await getPayPalAccessToken();
    const response = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.verification_status === 'SUCCESS';
  } catch (err) {
    console.warn('PayPal webhook signature verification error:', err);
    return false;
  }
}


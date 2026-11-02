import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PayPalSandboxProvider } from '../services/payment/PayPalSandboxProvider.js';
import { RunRecord } from '../repositories/RunRepository.js';

describe('PayPalSandboxProvider', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const mockRun: RunRecord = {
    id: 'run-test-123',
    userId: 'demo-user',
    status: 'approved',
    strategyType: 'STRATEGY_B_SINGLE_STORE',
    productSubtotalPaise: 8000,
    deliveryFeePaise: 500,
    handlingFeePaise: 0,
    taxPaise: 0,
    discountPaise: 0,
    grandTotalPaise: 8500, // ₹85.00 -> $1.00 USD at 85 rate
    decisionReasons: ['Weekly scheduled replenishment'],
    selectedStrategyDetails: null,
    simulatedDate: '2026-11-02T10:00:00Z',
    createdAt: '2026-11-02T10:00:00Z',
    updatedAt: '2026-11-02T10:00:00Z',
  };

  it('retrieves and caches OAuth2 token until expiration', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/v1/oauth2/token')) {
        callCount++;
        return new Response(
          JSON.stringify({
            access_token: 'A21AA-test-access-token',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const provider = new PayPalSandboxProvider(
      'test-client-id',
      'test-client-secret',
      'https://api-m.sandbox.paypal.com',
      85
    );

    const token1 = await provider.getAccessToken();
    const token2 = await provider.getAccessToken();

    expect(token1).toBe('A21AA-test-access-token');
    expect(token2).toBe('A21AA-test-access-token');
    expect(callCount).toBe(1); // Cached!
  });

  it('fails safely and clears cache on 401 unauthorized OAuth credentials', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/v1/oauth2/token')) {
        return new Response(
          JSON.stringify({
            error: 'invalid_client',
            error_description: 'Client Authentication failed',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const provider = new PayPalSandboxProvider(
      'bad-client-id',
      'bad-secret',
      'https://api-m.sandbox.paypal.com'
    );

    await expect(provider.getAccessToken()).rejects.toThrow(
      'PayPal authentication failed: Invalid Client ID or Secret'
    );
  });

  it('creates an order in USD with correct reference_id and idempotency header', async () => {
    let capturedOrderPayload: any = null;
    let capturedHeaders: Record<string, string> = {};

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/v1/oauth2/token')) {
        return new Response(
          JSON.stringify({ access_token: 'valid-token', expires_in: 3600 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/v2/checkout/orders')) {
        capturedOrderPayload = JSON.parse(init?.body as string);
        capturedHeaders = init?.headers as Record<string, string>;
        return new Response(
          JSON.stringify({
            id: 'ORDER-12345',
            status: 'CREATED',
            links: [
              { href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-12345', rel: 'self' },
              { href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-12345', rel: 'approve' },
            ],
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const provider = new PayPalSandboxProvider(
      'test-id',
      'test-secret',
      'https://api-m.sandbox.paypal.com',
      85
    );

    const order = await provider.createOrder(mockRun);

    expect(order.orderId).toBe('ORDER-12345');
    expect(order.usdAmount).toBe('1.00');
    expect(order.approvalUrl).toBe('https://www.sandbox.paypal.com/checkoutnow?token=ORDER-12345');
    expect(capturedOrderPayload.purchase_units[0].reference_id).toBe(mockRun.id);
    expect(capturedOrderPayload.purchase_units[0].amount.currency_code).toBe('USD');
    expect(capturedOrderPayload.purchase_units[0].amount.value).toBe('1.00');
    expect(capturedHeaders['PayPal-Request-Id']).toBe(mockRun.id);
  });

  it('captures an order and returns COMPLETED status and capture details', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/v1/oauth2/token')) {
        return new Response(
          JSON.stringify({ access_token: 'valid-token', expires_in: 3600 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/capture')) {
        return new Response(
          JSON.stringify({
            id: 'ORDER-12345',
            status: 'COMPLETED',
            payer: {
              email_address: 'buyer@example.com',
              payer_id: 'PAYER123',
            },
            purchase_units: [
              {
                payments: {
                  captures: [
                    {
                      id: 'CAPTURE-789',
                      status: 'COMPLETED',
                      amount: { currency_code: 'USD', value: '1.00' },
                      create_time: '2026-11-02T10:05:00Z',
                    },
                  ],
                },
              },
            ],
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const provider = new PayPalSandboxProvider(
      'test-id',
      'test-secret',
      'https://api-m.sandbox.paypal.com',
      85
    );

    const capture = await provider.captureOrder('ORDER-12345');

    expect(capture.status).toBe('COMPLETED');
    expect(capture.captureId).toBe('CAPTURE-789');
    expect(capture.payerEmail).toBe('buyer@example.com');
    expect(capture.usdAmount).toBe('1.00');
    expect(capture.capturedAt).toBe('2026-11-02T10:05:00Z');
  });

  it('recovers already captured orders when receiving 422 ORDER_ALREADY_CAPTURED', async () => {
    let getOrderCalled = false;

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/v1/oauth2/token')) {
        return new Response(
          JSON.stringify({ access_token: 'valid-token', expires_in: 3600 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/capture')) {
        return new Response(
          JSON.stringify({
            name: 'UNPROCESSABLE_ENTITY',
            message: 'The requested action could not be performed.',
            debug_id: 'test-debug-123',
            details: [
              {
                issue: 'ORDER_ALREADY_CAPTURED',
                description: 'Order has already been captured.',
              },
            ],
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/v2/checkout/orders/ORDER-ALREADY-DONE') && init?.method === 'GET') {
        getOrderCalled = true;
        return new Response(
          JSON.stringify({
            id: 'ORDER-ALREADY-DONE',
            status: 'COMPLETED',
            payer: { email_address: 'already-captured@example.com' },
            purchase_units: [
              {
                payments: {
                  captures: [
                    {
                      id: 'CAPTURE-EXISTING-999',
                      status: 'COMPLETED',
                      amount: { currency_code: 'USD', value: '1.00' },
                      create_time: '2026-11-02T09:00:00Z',
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const provider = new PayPalSandboxProvider(
      'test-id',
      'test-secret',
      'https://api-m.sandbox.paypal.com',
      85
    );

    const capture = await provider.captureOrder('ORDER-ALREADY-DONE');

    expect(getOrderCalled).toBe(true);
    expect(capture.status).toBe('COMPLETED');
    expect(capture.captureId).toBe('CAPTURE-EXISTING-999');
    expect(capture.payerEmail).toBe('already-captured@example.com');
  });

  it('handles 422 ORDER_NOT_APPROVED by throwing clear error code and description', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/v1/oauth2/token')) {
        return new Response(
          JSON.stringify({ access_token: 'valid-token', expires_in: 3600 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/capture')) {
        return new Response(
          JSON.stringify({
            name: 'UNPROCESSABLE_ENTITY',
            details: [
              {
                issue: 'ORDER_NOT_APPROVED',
                description:
                  "Payer has not yet approved the Order for payment. Please redirect the payer to the 'rel':'approve' url returned as part of the HATEOAS links within the Create Order call or provide a valid payment_source in the request.",
              },
            ],
            message: 'The requested action could not be performed.',
            debug_id: 'test-not-approved-123',
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const provider = new PayPalSandboxProvider(
      'test-id',
      'test-secret',
      'https://api-m.sandbox.paypal.com',
      85
    );

    await expect(provider.captureOrder('ORDER-UNAPPROVED-123')).rejects.toMatchObject({
      code: 'ORDER_NOT_APPROVED',
      statusCode: 422,
    });
  });

  it('throws timeout error when fetch is aborted or times out', async () => {
    global.fetch = vi.fn().mockImplementation(async () => {
      const err = new Error('The operation was aborted');
      err.name = 'TimeoutError';
      throw err;
    });

    const provider = new PayPalSandboxProvider(
      'test-id',
      'test-secret',
      'https://api-m.sandbox.paypal.com'
    );

    await expect(provider.getAccessToken()).rejects.toThrow('PayPal OAuth request timed out (10s)');
  });

  it('rejects with error if credentials are missing', async () => {
    const provider = new PayPalSandboxProvider('', '', 'https://api-m.sandbox.paypal.com');
    await expect(provider.getAccessToken()).rejects.toThrow('PayPal Sandbox client credentials are not configured');
  });
});

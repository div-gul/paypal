import { describe, expect, it, vi } from 'vitest';
import { PayPalSandboxProvider } from '../services/payment/PayPalSandboxProvider.js';

const paypalConfig = {
  PAYPAL_MODE: 'sandbox',
  PAYPAL_BASE_URL: 'https://api-m.sandbox.paypal.com',
  PAYPAL_CURRENCY: 'INR',
  PAYPAL_INR_PER_USD: undefined,
  PAYPAL_CLIENT_ID: 'sandbox-client',
  PAYPAL_CLIENT_SECRET: 'sandbox-secret',
  PAYPAL_WEBHOOK_ID: 'sandbox-webhook-id',
} as const;

const transmissionHeaders = {
  'paypal-auth-algo': 'SHA256withRSA',
  'paypal-cert-url': 'https://api-m.sandbox.paypal.com/cert',
  'paypal-transmission-id': 'transmission-id',
  'paypal-transmission-sig': 'signature',
  'paypal-transmission-time': '2026-11-10T00:00:00Z',
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('PayPal official webhook signature verification', () => {
  it('sends the event and required transmission headers to PayPal and accepts SUCCESS', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ access_token: 'test-access-token', expires_in: 300 }))
      .mockResolvedValueOnce(response({ verification_status: 'SUCCESS' }));
    const provider = new PayPalSandboxProvider(paypalConfig, fetcher);
    const event = { id: 'event-id', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'capture-id' } };

    await expect(provider.verifyWebhookSignature(transmissionHeaders, event)).resolves.toBe(true);

    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, init] = fetcher.mock.calls[1];
    expect(url).toBe('https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature');
    expect(JSON.parse(String(init?.body))).toEqual({
      auth_algo: transmissionHeaders['paypal-auth-algo'],
      cert_url: transmissionHeaders['paypal-cert-url'],
      transmission_id: transmissionHeaders['paypal-transmission-id'],
      transmission_sig: transmissionHeaders['paypal-transmission-sig'],
      transmission_time: transmissionHeaders['paypal-transmission-time'],
      webhook_id: 'sandbox-webhook-id',
      webhook_event: event,
    });
  });

  it('rejects PayPal FAILURE responses', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ access_token: 'test-access-token', expires_in: 300 }))
      .mockResolvedValueOnce(response({ verification_status: 'FAILURE' }));
    const provider = new PayPalSandboxProvider(paypalConfig, fetcher);

    await expect(provider.verifyWebhookSignature(transmissionHeaders, { id: 'event-id' })).resolves.toBe(false);
  });

  it('rejects missing transmission headers without making a PayPal request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const provider = new PayPalSandboxProvider(paypalConfig, fetcher);
    const incompleteHeaders = { ...transmissionHeaders, 'paypal-transmission-sig': '' };

    await expect(provider.verifyWebhookSignature(incompleteHeaders, { id: 'event-id' })).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

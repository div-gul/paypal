import { describe, expect, it } from 'vitest';
import { parseAppConfig } from '../config.js';
import { isStateResetAllowed } from '../routes/state.js';

describe('PayPal deployment safety config', () => {
  it('rejects a non-sandbox API host unless live payments are explicitly enabled', () => {
    expect(() => parseAppConfig({
      PAYPAL_MODE: 'sandbox',
      PAYPAL_BASE_URL: 'https://api-m.paypal.com',
      PAYPAL_CLIENT_ID: 'client-id',
      PAYPAL_CLIENT_SECRET: 'client-secret',
    })).toThrow('Invalid server configuration');
  });

  it('allows the live API host only with live mode and ALLOW_LIVE_PAYMENTS=true', () => {
    const config = parseAppConfig({
      PAYPAL_MODE: 'live',
      PAYPAL_BASE_URL: 'https://api-m.paypal.com',
      PAYPAL_CLIENT_ID: 'client-id',
      PAYPAL_CLIENT_SECRET: 'client-secret',
      ALLOW_LIVE_PAYMENTS: 'true',
    });
    expect(config.PAYPAL_MODE).toBe('live');
  });

  it('rejects production reset unless demo mode is explicitly enabled', () => {
    expect(isStateResetAllowed('production', undefined)).toBe(false);
    expect(isStateResetAllowed('production', 'false')).toBe(false);
    expect(isStateResetAllowed('production', 'true')).toBe(true);
    expect(isStateResetAllowed('development', undefined)).toBe(true);
  });

  it('requires HTTPS application origins in production', () => {
    expect(() => parseAppConfig({ NODE_ENV: 'production' })).toThrow('Invalid server configuration');
  });
});

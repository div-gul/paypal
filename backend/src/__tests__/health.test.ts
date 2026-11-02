import { describe, it, expect } from 'vitest';
import { createApp } from '../app.js';
import { config } from '../config.js';

describe('GET /api/health', () => {
  it('returns healthy status with demo user and service mode', async () => {
    const app = createApp();

    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      expect(res.status).toBe(200);

      const data: any = await res.json();
      expect(data.status).toBe('ok');
      expect(data.service).toBe('ShopPilot AI Backend');
      expect(data.user).toEqual({ id: 'demo-user' });
      expect(data.mode).toBeDefined();
      expect(data.mode.paypal).toBe(config.PAYPAL_MODE);
      expect(data.mode).toEqual({ paypal: config.PAYPAL_MODE });
    } finally {
      server.close();
    }
  });

  it('returns 404 for unknown /api route in standard error format', async () => {
    const app = createApp();
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/non-existent`);
      expect(res.status).toBe(404);

      const data: any = await res.json();
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('NOT_FOUND');
    } finally {
      server.close();
    }
  });

  it('GET /api/config/public returns safe public PayPal configuration and no secrets', async () => {
    const app = createApp();
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/config/public`);
      expect(res.status).toBe(200);

      const data: any = await res.json();
      expect(data.paypalMode).toBe(config.PAYPAL_MODE);
      expect(data.currency).toBe('USD');
      expect(data.usdRate).toBe(85);
      expect(typeof data.paypalClientId).toBe('string');
      // Crucial security check: secrets must NEVER be returned
      expect(data.paypalClientSecret).toBeUndefined();
      expect(data.clientSecret).toBeUndefined();
      expect(data.secret).toBeUndefined();
      expect(data.webhookId).toBeUndefined();
    } finally {
      server.close();
    }
  });
});

import { describe, it, expect } from 'vitest';
import { createApp } from '../app.js';

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
      expect(data.mode.paypal).toBe('mock');
      expect(['mock', 'hybrid', 'channel3']).toContain(data.mode.quotes);
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
});

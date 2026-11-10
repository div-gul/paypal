import { describe, it, expect } from 'vitest';
import { createApp } from '../app.js';

describe('GET /api/health', () => {
  it('returns minimal health state and security headers', async () => {
    const app = createApp({ testAuth: true });

    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      expect(res.status).toBe(200);

      const data: any = await res.json();
      expect(data.status).toBe('ok');
      expect(data).toEqual({ status: 'ok', mode: 'mock' });
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
      expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
      expect(res.headers.get('x-powered-by')).toBeNull();
    } finally {
      server.close();
    }
  });

  it('rejects state-changing requests from an untrusted origin', async () => {
    const app = createApp({ testAuth: true });
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/auth/logout`, {
        method: 'POST', headers: { Origin: 'https://attacker.example' },
      });
      expect(res.status).toBe(403);
      expect((await res.json() as any).error.code).toBe('ORIGIN_NOT_ALLOWED');
    } finally { server.close(); }
  });

  it('returns 404 for unknown /api route in standard error format', async () => {
    const app = createApp({ testAuth: true });
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

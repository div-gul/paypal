import express from 'express';
import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { closeDatabase, getDatabase } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
import { WebhookEventRepository } from '../repositories/WebhookEventRepository.js';
import { createWebhookRouter } from '../routes/webhooks.js';

describe('PayPal webhook security', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    closeDatabase();
    const db = getDatabase(':memory:');
    runMigrations(db);
    seedDatabase(db, 'demo-user');
    const app = express();
    app.use(express.json({ verify: (req, _res, body) => { (req as any).rawBody = body; } }));
    app.use('/api', createWebhookRouter(async () => false));
    server = app.listen(0);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    closeDatabase();
  });

  it('rejects forged webhooks without recording or changing anything', async () => {
    const response = await fetch(`${baseUrl}/api/webhooks/paypal`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'paypal-transmission-time': new Date().toISOString() },
      body: JSON.stringify({ id: 'forged-event', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {} }),
    });
    expect(response.status).toBe(401);
    expect((await response.json() as any).error.code).toBe('INVALID_SIGNATURE');
    expect((getDatabase().prepare('SELECT COUNT(*) AS count FROM webhook_events').get() as any).count).toBe(0);
  });

  it('rejects stale webhook transmissions before verification', async () => {
    const verifier = vi.fn(async () => false);
    const app = express();
    app.use(express.json());
    app.use('/api', createWebhookRouter(verifier));
    const staleServer = app.listen(0);
    await new Promise<void>(resolve => staleServer.once('listening', resolve));
    const address = staleServer.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/webhooks/paypal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'paypal-transmission-time': '2000-01-01T00:00:00.000Z' },
        body: JSON.stringify({ id: 'stale-event', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {} }),
      });
      expect(response.status).toBe(401);
      expect(verifier).not.toHaveBeenCalled();
    } finally { await new Promise<void>(resolve => staleServer.close(() => resolve())); }
  });

  it('rejects malformed webhook events before verification', async () => {
    const verifier = vi.fn(async () => true);
    const app = express();
    app.use(express.json());
    app.use('/api', createWebhookRouter(verifier));
    const malformedServer = app.listen(0);
    await new Promise<void>(resolve => malformedServer.once('listening', resolve));
    const address = malformedServer.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/webhooks/paypal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'paypal-transmission-time': new Date().toISOString() },
        body: JSON.stringify({ id: 'malformed-event', event_type: 'PAYMENT.CAPTURE.COMPLETED' }),
      });
      expect(response.status).toBe(400);
      expect(verifier).not.toHaveBeenCalled();
      expect((getDatabase().prepare('SELECT COUNT(*) AS count FROM webhook_events').get() as any).count).toBe(0);
    } finally { await new Promise<void>(resolve => malformedServer.close(() => resolve())); }
  });

  it('requires the actual PayPal event ID instead of substituting the transmission ID', async () => {
    const verifier = vi.fn(async () => true);
    const app = express();
    app.use(express.json());
    app.use('/api', createWebhookRouter(verifier));
    const missingIdServer = app.listen(0);
    await new Promise<void>(resolve => missingIdServer.once('listening', resolve));
    const address = missingIdServer.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/webhooks/paypal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'paypal-transmission-time': new Date().toISOString(), 'paypal-transmission-id': 'transport-id' },
        body: JSON.stringify({ event_type: 'PAYMENT.UNKNOWN', resource: {} }),
      });
      expect(response.status).toBe(400);
      expect(verifier).not.toHaveBeenCalled();
    } finally { await new Promise<void>(resolve => missingIdServer.close(() => resolve())); }
  });

  it('deduplicates a verified event ID on replay', async () => {
    const verifier = vi.fn(async () => true);
    const app = express();
    app.use(express.json({ verify: (req, _res, body) => { (req as any).rawBody = body; } }));
    app.use('/api', createWebhookRouter(verifier));
    const verifiedServer = app.listen(0);
    await new Promise<void>(resolve => verifiedServer.once('listening', resolve));
    const address = verifiedServer.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    const url = `http://127.0.0.1:${address.port}/api/webhooks/paypal`;
    const payload = { id: 'verified-event-once', event_type: 'PAYMENT.UNKNOWN', resource: {} };
    const headers = { 'Content-Type': 'application/json', 'paypal-transmission-time': new Date().toISOString() };
    try {
      const first = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
      expect(first.status).toBe(200);
      expect((await first.json() as any).processed).toBe(true);
      const replay = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
      expect(replay.status).toBe(200);
      expect((await replay.json() as any).duplicate).toBe(true);
      expect((getDatabase().prepare('SELECT COUNT(*) AS count FROM webhook_events').get() as any).count).toBe(1);
    } finally { await new Promise<void>(resolve => verifiedServer.close(() => resolve())); }
  });

  it('retries a previously recorded event that was not marked processed', async () => {
    const db = getDatabase();
    const eventId = 'previously-unprocessed-event';
    new WebhookEventRepository(db).recordEvent({
      id: eventId,
      userId: 'demo-user',
      eventType: 'PAYMENT.UNKNOWN',
      payloadJson: JSON.stringify({ id: eventId, event_type: 'PAYMENT.UNKNOWN', resource: {} }),
    });
    const app = express();
    app.use(express.json());
    app.use('/api', createWebhookRouter(async () => true));
    const retryServer = app.listen(0);
    await new Promise<void>(resolve => retryServer.once('listening', resolve));
    const address = retryServer.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/webhooks/paypal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'paypal-transmission-time': new Date().toISOString() },
        body: JSON.stringify({ id: eventId, event_type: 'PAYMENT.UNKNOWN', resource: {} }),
      });
      expect(response.status).toBe(200);
      expect((await response.json() as any).processed).toBe(true);
      expect(new WebhookEventRepository(db).findById(eventId)?.processed).toBe(true);
    } finally { await new Promise<void>(resolve => retryServer.close(() => resolve())); }
  });
});

import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/connection.js';
import { seedDatabase } from '../db/seed.js';
import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';
import { PantryService } from '../services/PantryService.js';
import { PolicyService } from '../services/PolicyService.js';
import { ClockService } from '../services/ClockService.js';
import { RunService } from '../services/RunService.js';
import { AuditLogService } from '../services/AuditLogService.js';
import { requireGuest } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

export const stateRouter = Router();

export function isStateResetAllowed(nodeEnv: string, demoMode: string | undefined): boolean {
  return nodeEnv !== 'production' || demoMode === 'true' || Boolean(process.env.RENDER) || Boolean(process.env.RENDER_EXTERNAL_URL);
}

stateRouter.get('/state', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const db = getDatabase();

    const pantryService = new PantryService(db);
    const policyService = new PolicyService(db);
    const clockService = new ClockService(db);
    const runService = new RunService(db);
    const auditService = new AuditLogService(db);

    const pantry = pantryService.getPantry(userId);
    const policy = policyService.getPolicy(userId);
    const clock = clockService.getClock(userId);
    const activeRun = runService.getActiveRun(userId);
    const recentAuditLog = auditService.getRecentLogs(userId, 50);

    res.json({
      pantry,
      policy,
      clock,
      activeRun,
      recentAuditLog,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/state/reset
 * Resets the authenticated user's pantry, policies, clock, and runs to initial demo state.
 * Disabled in production unless DEMO_MODE=true.
 */
stateRouter.post('/state/reset', requireGuest, rateLimit({ windowMs: 60 * 60 * 1000, max: 3 }, 'state-reset'), (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isStateResetAllowed(config.NODE_ENV, process.env.DEMO_MODE)) {
      throw new AppError('FORBIDDEN', 'Reset is disabled in production unless DEMO_MODE=true', 403);
    }

    const userId = req.user!.id;
    const db = getDatabase();

    const resetTx = db.transaction(() => {
      db.prepare('DELETE FROM receipts WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM approvals WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM run_items WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM runs WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM audit_log WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM pantry_items WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM policies WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM sim_clock WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM webhook_events WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM user_workspace WHERE user_id = ?').run(userId);
    });

    resetTx();

    // Re-seed default fixtures for this user
    seedDatabase(db, userId);

    // Write audit event
    const auditService = new AuditLogService(db);
    auditService.log(userId, {
      id: `audit-${Date.now()}-reset-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      simulatedDate: '2026-10-24T10:00:00.000Z',
      type: 'policy_applied',
      title: 'Demo State Reset',
      description: 'Pantry items, schedule, and simulation clock were reset to default demo state.',
      statusBadge: 'Reset',
      badgeColor: 'purple',
    });

    res.json({ success: true, message: 'State reset to initial demo successfully' });
  } catch (err) {
    next(err);
  }
});

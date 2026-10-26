import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/connection.js';
import { PantryService } from '../services/PantryService.js';
import { PolicyService } from '../services/PolicyService.js';
import { ClockService } from '../services/ClockService.js';
import { RunService } from '../services/RunService.js';
import { AuditLogService } from '../services/AuditLogService.js';

export const stateRouter = Router();

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

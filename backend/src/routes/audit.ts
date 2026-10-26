import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection.js';
import { AuditLogService } from '../services/AuditLogService.js';

export const auditRouter = Router();

const AuditLimitSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

auditRouter.get('/audit-log', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = AuditLimitSchema.parse(req.query);
    const auditService = new AuditLogService(getDatabase());
    const logs = auditService.getRecentLogs(req.user!.id, limit);
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

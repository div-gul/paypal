import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection.js';

export const workspaceRouter = Router();
const WorkspaceSchema = z.object({
  upcomingOrder: z.record(z.string(), z.unknown()).nullable().optional(),
  swapDecisions: z.record(z.string(), z.enum(['approved', 'rejected'])).optional(),
}).strict()
  .refine(value => value.upcomingOrder !== undefined || value.swapDecisions !== undefined)
  .refine(value => !value.swapDecisions || Object.keys(value.swapDecisions).length <= 500);

workspaceRouter.get('/workspace', (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = getDatabase().prepare('SELECT upcoming_order_json, swap_decisions_json FROM user_workspace WHERE user_id = ?')
      .get(req.user!.id) as { upcoming_order_json: string | null; swap_decisions_json: string } | undefined;
    res.json({
      upcomingOrder: row?.upcoming_order_json ? JSON.parse(row.upcoming_order_json) : null,
      swapDecisions: row?.swap_decisions_json ? JSON.parse(row.swap_decisions_json) : {},
    });
  } catch (err) { next(err); }
});

workspaceRouter.put('/workspace', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = WorkspaceSchema.parse(req.body);
    const existing = getDatabase().prepare('SELECT upcoming_order_json, swap_decisions_json FROM user_workspace WHERE user_id = ?')
      .get(req.user!.id) as { upcoming_order_json: string | null; swap_decisions_json: string } | undefined;
    const serialized = data.upcomingOrder === undefined
      ? existing?.upcoming_order_json ?? null
      : data.upcomingOrder === null ? null : JSON.stringify(data.upcomingOrder);
    const serializedSwaps = JSON.stringify(data.swapDecisions ?? (existing?.swap_decisions_json ? JSON.parse(existing.swap_decisions_json) : {}));
    if ((serialized?.length || 0) + serializedSwaps.length > 500_000) {
      res.status(413).json({ error: { code: 'WORKSPACE_TOO_LARGE', message: 'Saved basket is too large.' } });
      return;
    }
    getDatabase().prepare(`
      INSERT INTO user_workspace(user_id, upcoming_order_json, swap_decisions_json, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET upcoming_order_json = excluded.upcoming_order_json,
        swap_decisions_json = excluded.swap_decisions_json, updated_at = excluded.updated_at
    `).run(req.user!.id, serialized, serializedSwaps, new Date().toISOString());
    res.json({ success: true });
  } catch (err) { next(err); }
});

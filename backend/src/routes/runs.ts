import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection.js';
import { RunService } from '../services/RunService.js';
import { RunItemRepository } from '../repositories/RunItemRepository.js';

export const runsRouter = Router();

const StrategyTypeSchema = z.enum([
  'STRATEGY_A_LOWEST_PRICE',
  'STRATEGY_B_SINGLE_STORE',
  'STRATEGY_C_SMART_SPLIT',
  'STRATEGY_D_DEFER_NON_URGENT',
]);

const PlanRunInputSchema = z.object({
  includeItemIds: z.array(z.string()).optional(),
  excludeItemIds: z.array(z.string()).optional(),
  strategy: StrategyTypeSchema.optional(),
});

const ChangeStrategyInputSchema = z.object({
  strategy: StrategyTypeSchema,
});

const LimitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

runsRouter.post('/runs/plan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const overrides = req.body && Object.keys(req.body).length > 0 ? PlanRunInputSchema.parse(req.body) : undefined;
    const runService = new RunService(getDatabase());
    const planResult = await runService.planRun(req.user!.id, overrides);
    res.status(201).json(planResult);
  } catch (err) {
    next(err);
  }
});

runsRouter.put('/runs/:id/strategy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { strategy } = ChangeStrategyInputSchema.parse(req.body);
    const runService = new RunService(getDatabase());
    const result = await runService.selectRunStrategy(req.user!.id, id, strategy);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

runsRouter.post('/runs/:id/approve', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const runService = new RunService(getDatabase());
    const approved = runService.approveRun(req.user!.id, id);
    res.json({ run: approved });
  } catch (err) {
    next(err);
  }
});

runsRouter.post('/runs/:id/reject', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const runService = new RunService(getDatabase());
    const rejected = runService.rejectRun(req.user!.id, id);
    res.json({ run: rejected });
  } catch (err) {
    next(err);
  }
});

runsRouter.get('/runs', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = LimitQuerySchema.parse(req.query);
    const runService = new RunService(getDatabase());
    const runs = runService.getRuns(req.user!.id, limit);
    res.json({ runs });
  } catch (err) {
    next(err);
  }
});

runsRouter.get('/runs/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const db = getDatabase();
    const runService = new RunService(db);
    const runItemRepo = new RunItemRepository(db);

    const run = runService.getRunById(req.user!.id, id);
    const items = runItemRepo.getByRunId(req.user!.id, id);

    res.json({ run, items });
  } catch (err) {
    next(err);
  }
});

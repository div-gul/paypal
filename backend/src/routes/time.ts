import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection.js';
import { ClockService } from '../services/ClockService.js';

export const timeRouter = Router();

const AdvanceTimeSchema = z.object({
  days: z.union([z.literal(1), z.literal(3), z.literal(7)]),
});

timeRouter.get('/time', (req: Request, res: Response, next: NextFunction) => {
  try {
    const clockService = new ClockService(getDatabase());
    const clock = clockService.getClock(req.user!.id);
    res.json({ clock });
  } catch (err) {
    next(err);
  }
});

timeRouter.post('/time/advance', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { days } = AdvanceTimeSchema.parse(req.body);
    const clockService = new ClockService(getDatabase());
    const result = clockService.advanceTime(req.user!.id, days);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

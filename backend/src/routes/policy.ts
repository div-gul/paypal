import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection.js';
import { PolicyService } from '../services/PolicyService.js';

export const policyRouter = Router();

const UpdatePolicySchema = z.object({
  preferredShoppingDay: z.number().int().min(0).max(6).optional(),
  shoppingFrequency: z.enum(['weekly', 'biweekly']).optional(),
  nextShoppingDate: z.string().optional(),
  emergencyRestockPreference: z.enum(['ask_approval', 'auto_order', 'alert_only']).optional(),
  urgentThresholdDays: z.number().int().min(1).max(14).optional(),
  perCycleBudgetPaise: z.number().int().min(0).optional(),
  perOrderCapPaise: z.number().int().min(0).optional(),
  requireApprovalBrandSubstitution: z.boolean().optional(),
  requireApprovalEmergencyRun: z.boolean().optional(),
  blockedCategories: z.array(z.string()).optional(),
});

policyRouter.get('/policy', (req: Request, res: Response, next: NextFunction) => {
  try {
    const policyService = new PolicyService(getDatabase());
    const policy = policyService.getPolicy(req.user!.id);
    res.json({ policy });
  } catch (err) {
    next(err);
  }
});

policyRouter.put('/policy', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = UpdatePolicySchema.parse(req.body);
    const policyService = new PolicyService(getDatabase());
    const updated = policyService.updatePolicy(req.user!.id, validated);
    res.json({ policy: updated });
  } catch (err) {
    next(err);
  }
});

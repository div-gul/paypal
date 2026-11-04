import { Router } from 'express';
import { z } from 'zod';
import { LLMService } from '../services/ai/LLMService.js';
import { PolicyService } from '../services/PolicyService.js';
import { getDatabase } from '../db/connection.js';
import { StoreProduct } from '@shared/types';

const ParsePolicyInputSchema = z.object({
  prompt: z.string().min(2, 'Prompt must be at least 2 characters'),
});

const StoreProductInputSchema = z.object({
  id: z.string(),
  storeId: z.enum(['blinkit', 'zepto', 'instamart']),
  pantryItemId: z.string(),
  name: z.string(),
  brand: z.string(),
  packageSize: z.string(),
  unit: z.string(),
  pricePaise: z.number().int().nonnegative(),
  mrpPaise: z.number().int().nonnegative(),
  inStock: z.boolean(),
  stockQuantity: z.number().int().nonnegative(),
  isExactBrandMatch: z.boolean(),
});

const SubstituteInputSchema = z.object({
  pantryItemId: z.string(),
  itemName: z.string(),
  preferredBrand: z.string(),
  reason: z.string().optional(),
  candidates: z.array(StoreProductInputSchema).min(1, 'Must provide at least 1 candidate product'),
});

export function createAiRouter(llmService?: LLMService): Router {
  const router = Router();
  const service = llmService || new LLMService();

  /**
   * POST /api/ai/parse-policy
   * Parses natural language into a proposed policy modification.
   * NOTE: Pure proposal. User must review and call PUT /api/policy to commit changes.
   */
  router.post('/parse-policy', async (req, res, next) => {
    try {
      const parsed = ParsePolicyInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid prompt payload',
            details: parsed.error.issues,
          },
        });
      }

      const userId = req.user!.id;
      const policyService = new PolicyService(getDatabase());
      const currentPolicy = policyService.getPolicy(userId);
      const proposal = await service.parsePolicy(parsed.data.prompt, currentPolicy);

      return res.status(200).json({ proposal });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/ai/substitute
   * Selects the closest in-stock alternative strictly from the server-provided candidate list.
   */
  router.post('/substitute', async (req, res, next) => {
    try {
      const parsed = SubstituteInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid substitution payload',
            details: parsed.error.issues,
          },
        });
      }

      const substitute = await service.selectSubstitute({
        pantryItemId: parsed.data.pantryItemId,
        itemName: parsed.data.itemName,
        preferredBrand: parsed.data.preferredBrand,
        reason: parsed.data.reason,
        candidates: parsed.data.candidates as unknown as StoreProduct[],
      });
      return res.status(200).json({ substitute });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

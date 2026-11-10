import { Router } from 'express';
import { z } from 'zod';
import { LLMService } from '../services/ai/LLMService.js';
import { PolicyService } from '../services/PolicyService.js';
import { getDatabase } from '../db/connection.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { PantryService } from '../services/PantryService.js';
import { QuoteService } from '../services/QuoteService.js';

const ParsePolicyInputSchema = z.object({
  prompt: z.string().min(2, 'Prompt must be at least 2 characters').max(500).refine(value => !/[\u0000-\u001f\u007f]/.test(value), 'Control characters are not allowed'),
});

const SubstituteInputSchema = z.object({
  pantryItemId: z.string().min(1).max(100),
  reason: z.string().max(300).optional(),
}).strict();

export function createAiRouter(llmService?: LLMService): Router {
  const router = Router();
  const service = llmService || new LLMService();

  /**
   * POST /api/ai/parse-policy
   * Parses natural language into a proposed policy modification.
   * NOTE: Pure proposal. User must review and call PUT /api/policy to commit changes.
   */
  router.post('/parse-policy', rateLimit({ windowMs: 60_000, max: 10 }, 'ai-minute'), rateLimit({ windowMs: 24 * 60 * 60_000, max: 100 }, 'ai-daily'), async (req, res, next) => {
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
  router.post('/substitute', rateLimit({ windowMs: 60_000, max: 10 }, 'ai-minute'), rateLimit({ windowMs: 24 * 60 * 60_000, max: 100 }, 'ai-daily'), async (req, res, next) => {
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

      const userId = req.user!.id;
      const db = getDatabase();
      const pantryItem = new PantryService(db).getItem(userId, parsed.data.pantryItemId);
      const candidates = await new QuoteService(db).getQuotesForPantryItemId(userId, pantryItem.id);
      if (candidates.length === 0) {
        return res.status(400).json({ error: { code: 'NO_CANDIDATES', message: 'No server catalog candidates are available for this pantry item.' } });
      }

      const substitute = await service.selectSubstitute({
        pantryItemId: pantryItem.id,
        itemName: pantryItem.name,
        preferredBrand: pantryItem.preferredBrand,
        reason: parsed.data.reason,
        candidates,
      });
      return res.status(200).json({ substitute });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

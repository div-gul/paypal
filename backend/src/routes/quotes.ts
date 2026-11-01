import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/connection.js';
import { QuoteService } from '../services/QuoteService.js';

export const quotesRouter = Router();

/**
 * GET /api/quotes
 * Returns local quick-commerce quotes (Blinkit, Zepto, Instamart) for basket optimization,
 * Returns simulated quotes from the local store adapters.
 */
quotesRouter.get('/quotes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quoteService = new QuoteService(getDatabase());
    const quotes = await quoteService.getQuotesForUser(req.user!.id);
    res.json({
      totalQuotes: quotes.length,
      quotes,
    });
  } catch (err) {
    next(err);
  }
});

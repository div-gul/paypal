import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/connection.js';
import { QuoteService } from '../services/QuoteService.js';
import { config } from '../config.js';

export const quotesRouter = Router();

/**
 * GET /api/quotes
 * Returns local quick-commerce quotes (Blinkit, Zepto, Instamart) for basket optimization,
 * and optional webQuotes from Channel3 for real web product price checks for non-grocery items.
 */
quotesRouter.get('/quotes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quoteService = new QuoteService(getDatabase());
    const { quotes, webQuotes } = await quoteService.getQuotesForUser(req.user!.id);
    res.json({
      mode: config.QUOTE_SOURCE,
      description: 'Quick-commerce grocery quotes for basket optimization; webQuotes provide real web product price checks for non-grocery items.',
      totalQuotes: quotes.length,
      quotes,
      webQuotes,
    });
  } catch (err) {
    next(err);
  }
});

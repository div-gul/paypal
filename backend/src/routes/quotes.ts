import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/connection.js';
import { QuoteService } from '../services/QuoteService.js';
import { config } from '../config.js';

export const quotesRouter = Router();

quotesRouter.get('/quotes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quoteService = new QuoteService(getDatabase());
    const quotes = await quoteService.getQuotesForUser(req.user!.id);
    res.json({
      mode: config.QUOTE_SOURCE,
      totalQuotes: quotes.length,
      quotes,
    });
  } catch (err) {
    next(err);
  }
});

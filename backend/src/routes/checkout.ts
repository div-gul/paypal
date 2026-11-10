import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection.js';
import { PaymentService } from '../services/payment/PaymentService.js';
import { config } from '../config.js';
import { rateLimit } from '../middleware/rateLimit.js';

export const checkoutRouter = Router();

const CreateOrderSchema = z.object({
  runId: z.string().min(1),
  addressId: z.string().min(1),
}).strict();

const CaptureOrderSchema = z.object({
  orderId: z.string().min(1),
}).strict();

const CancelOrderSchema = z.object({
  runId: z.string().min(1),
  orderId: z.string().optional(),
}).strict();

checkoutRouter.get('/checkout/config', (_req: Request, res: Response) => {
  res.json({
    mode: config.PAYPAL_MODE,
    clientId: config.PAYPAL_MODE === 'mock' ? null : config.PAYPAL_CLIENT_ID,
    currency: config.PAYPAL_MODE === 'mock' ? 'INR' : config.PAYPAL_CURRENCY,
    provider: config.PAYPAL_MODE === 'live' ? 'paypal_live' : config.PAYPAL_MODE === 'sandbox' ? 'paypal_sandbox' : 'mock',
  });
});

checkoutRouter.post('/checkout/create-order', rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }, 'checkout-create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId, addressId } = CreateOrderSchema.parse(req.body);
    const paymentService = new PaymentService(getDatabase());
    const result = await paymentService.createCheckoutOrder(req.user!.id, runId, addressId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

checkoutRouter.post('/checkout/capture', rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }, 'checkout-capture'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = CaptureOrderSchema.parse(req.body);
    const paymentService = new PaymentService(getDatabase());
    const result = await paymentService.captureCheckoutOrder(req.user!.id, orderId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

checkoutRouter.get('/checkout/status/:runId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paymentService = new PaymentService(getDatabase());
    const status = await paymentService.getCheckoutStatus(req.user!.id, req.params.runId as string);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

checkoutRouter.post('/checkout/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId, orderId } = CancelOrderSchema.parse(req.body);
    const paymentService = new PaymentService(getDatabase());
    const result = await paymentService.cancelCheckoutOrder(req.user!.id, runId, orderId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

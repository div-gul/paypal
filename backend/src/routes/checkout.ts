import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection.js';
import { PaymentService } from '../services/payment/PaymentService.js';
import { config } from '../config.js';

export const checkoutRouter = Router();

const CreateOrderSchema = z.object({
  runId: z.string().min(1),
});

const CaptureOrderSchema = z.object({
  orderId: z.string().min(1),
  runId: z.string().optional(),
});

const CancelOrderSchema = z.object({
  runId: z.string().min(1),
  orderId: z.string().optional(),
});

checkoutRouter.get('/checkout/config', (_req: Request, res: Response) => {
  res.json({
    mode: config.PAYPAL_MODE,
    clientId: config.PAYPAL_MODE === 'sandbox' ? config.PAYPAL_CLIENT_ID : null,
    currency: config.PAYPAL_MODE === 'sandbox' ? config.PAYPAL_CURRENCY : 'INR',
    provider: config.PAYPAL_MODE === 'sandbox' ? 'paypal_sandbox' : 'mock',
  });
});

checkoutRouter.post('/checkout/create-order', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = CreateOrderSchema.parse(req.body);
    const paymentService = new PaymentService(getDatabase());
    const result = await paymentService.createCheckoutOrder(req.user!.id, runId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

checkoutRouter.post('/checkout/capture', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId, runId } = CaptureOrderSchema.parse(req.body);
    const paymentService = new PaymentService(getDatabase());
    const result = await paymentService.captureCheckoutOrder(req.user!.id, orderId, runId);
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

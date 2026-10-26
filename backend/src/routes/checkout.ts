import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection.js';
import { PaymentService } from '../services/payment/PaymentService.js';

export const checkoutRouter = Router();

const CreateOrderSchema = z.object({
  runId: z.string().min(1),
});

const CaptureOrderSchema = z.object({
  orderId: z.string().min(1),
  runId: z.string().min(1),
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

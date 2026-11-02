import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection.js';
import { PaymentService } from '../services/payment/PaymentService.js';

export const checkoutRouter = Router();

const CreateOrderSchema = z.object({
  runId: z.string().min(1),
  simulated: z.boolean().optional(),
});

const CaptureOrderSchema = z.object({
  orderId: z.string().min(1),
  runId: z.string().optional(),
});

checkoutRouter.post('/checkout/create-order', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId, simulated } = CreateOrderSchema.parse(req.body);
    const paymentService = new PaymentService(getDatabase());
    const result = await paymentService.createCheckoutOrder(req.user!.id, runId, { simulated });
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

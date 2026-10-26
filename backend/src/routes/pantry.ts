import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection.js';
import { PantryService } from '../services/PantryService.js';
import { ProductCategory, UnitOfMeasurement } from '@shared/types';

export const pantryRouter = Router();

const ProductCategorySchema = z.enum([
  'Dairy',
  'Bakery & Bread',
  'Fresh Produce',
  'Beverages',
  'Pantry Staples',
  'Breakfast & Cereals',
  'Snacks',
  'Personal Care',
]);

const UnitSchema = z.enum(['L', 'kg', 'g', 'ml', 'packs', 'pcs', 'units', 'eggs']);

const CreatePantryItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  category: ProductCategorySchema,
  preferredBrand: z.string().min(1),
  preferredPackageSize: z.string().min(1),
  unit: UnitSchema,
  currentQuantity: z.number().min(0),
  averageDailyConsumption: z.number().min(0),
  minStockThreshold: z.number().min(0),
  targetStock: z.number().min(0),
  allowSubstitutions: z.boolean().default(true),
  requireApprovalForBrandChange: z.boolean().default(true),
  lastRestockedDate: z.string().optional(),
});

const UpdatePantryItemSchema = CreatePantryItemSchema.partial();

const AdjustQuantitySchema = z.object({
  delta: z.number(),
});

pantryRouter.get('/pantry', (req: Request, res: Response, next: NextFunction) => {
  try {
    const pantryService = new PantryService(getDatabase());
    const items = pantryService.getPantry(req.user!.id);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

pantryRouter.get('/pantry/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const pantryService = new PantryService(getDatabase());
    const item = pantryService.getItem(req.user!.id, id);
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

pantryRouter.post('/pantry', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CreatePantryItemSchema.parse(req.body);
    const pantryService = new PantryService(getDatabase());
    const itemId = validated.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const created = pantryService.createItem(req.user!.id, {
      id: itemId,
      name: validated.name,
      category: validated.category as ProductCategory,
      preferredBrand: validated.preferredBrand,
      preferredPackageSize: validated.preferredPackageSize,
      unit: validated.unit as UnitOfMeasurement,
      currentQuantity: validated.currentQuantity,
      averageDailyConsumption: validated.averageDailyConsumption,
      minStockThreshold: validated.minStockThreshold,
      targetStock: validated.targetStock,
      allowSubstitutions: validated.allowSubstitutions ?? true,
      requireApprovalForBrandChange: validated.requireApprovalForBrandChange ?? true,
      lastRestockedDate: validated.lastRestockedDate || new Date().toISOString(),
    });

    res.status(201).json({ item: created });
  } catch (err) {
    next(err);
  }
});

pantryRouter.put('/pantry/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const validated = UpdatePantryItemSchema.parse(req.body);
    const pantryService = new PantryService(getDatabase());
    const updated = pantryService.updateItem(req.user!.id, id, validated);
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

pantryRouter.delete('/pantry/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const pantryService = new PantryService(getDatabase());
    pantryService.deleteItem(req.user!.id, id);
    res.json({ success: true, message: `Item ${id} deleted` });
  } catch (err) {
    next(err);
  }
});

pantryRouter.post('/pantry/:id/adjust', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { delta } = AdjustQuantitySchema.parse(req.body);
    const pantryService = new PantryService(getDatabase());
    const updated = pantryService.adjustQuantity(req.user!.id, id, delta);
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

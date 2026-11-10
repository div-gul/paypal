import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection.js';
import { PantryService } from '../services/PantryService.js';
import { ProductCategory, UnitOfMeasurement } from '@shared/types';
import { AppError } from '../middleware/errorHandler.js';
import { rateLimit } from '../middleware/rateLimit.js';

const pantryWriteLimit = rateLimit({ windowMs: 60_000, max: 60 }, 'pantry-write');

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
  'Household',
  'Household Essentials',
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
  quantityStep: z.number().positive().optional(),
  allowFractions: z.boolean().optional(),
  imageUrl: z.string().optional().nullable(),
});

const UpdatePantryItemSchema = CreatePantryItemSchema.partial();

const AdjustQuantitySchema = z.object({
  delta: z.number(),
});

function validateStockRules(
  currentQuantity?: number,
  targetStock?: number,
  minStockThreshold?: number,
  unit?: string,
  quantityStep?: number,
  allowFractions?: boolean
) {
  const isCountable = unit ? ['pcs', 'packs', 'units', 'eggs', 'loaf', 'pack', 'dozen'].includes(unit.toLowerCase()) : false;
  const effectiveStep = quantityStep ?? (isCountable ? 1 : 0.5);
  const effectiveFractions = allowFractions ?? !isCountable;

  const checkField = (name: string, val?: number) => {
    if (val === undefined) return;
    const stepsRatio = val / effectiveStep;
    if (Math.abs(Math.round(stepsRatio) - stepsRatio) > 1e-5) {
      throw new AppError(
        'INVALID_QUANTITY_STEP',
        `${name} ${val} must be a multiple of quantity step ${effectiveStep}`,
        400
      );
    }
    if (!effectiveFractions) {
      const isInteger = Math.abs(Math.round(val) - val) < 1e-5;
      if (!isInteger) {
        throw new AppError(
          'INVALID_QUANTITY_STEP',
          `${name} cannot be fractional when allowFractions is false`,
          400
        );
      }
    }
  };

  checkField('currentQuantity', currentQuantity);
  checkField('targetStock', targetStock);
  checkField('minStockThreshold', minStockThreshold);
}

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

pantryRouter.post('/pantry', pantryWriteLimit, (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CreatePantryItemSchema.parse(req.body);
    validateStockRules(
      validated.currentQuantity,
      validated.targetStock,
      validated.minStockThreshold,
      validated.unit,
      validated.quantityStep,
      validated.allowFractions
    );

    const pantryService = new PantryService(getDatabase());
    if (pantryService.getPantry(req.user!.id).length >= 100) {
      throw new AppError('PANTRY_LIMIT', 'This account has reached the pantry item limit.', 409);
    }
    const itemId = validated.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const isCountable = ['pcs', 'packs', 'units', 'eggs', 'loaf', 'pack', 'dozen'].includes(validated.unit.toLowerCase());
    const quantityStep = validated.quantityStep ?? (isCountable ? 1 : 0.5);
    const allowFractions = validated.allowFractions ?? !isCountable;

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
      quantityStep,
      allowFractions,
      imageUrl: validated.imageUrl || undefined,
    });

    res.status(201).json({ item: created });
  } catch (err) {
    next(err);
  }
});

pantryRouter.put('/pantry/:id', pantryWriteLimit, (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const validated = UpdatePantryItemSchema.parse(req.body);
    const pantryService = new PantryService(getDatabase());
    const existing = pantryService.getItem(req.user!.id, id);

    const unit = validated.unit ?? existing.unit;
    const quantityStep = validated.quantityStep ?? existing.quantityStep;
    const allowFractions = validated.allowFractions ?? existing.allowFractions;

    validateStockRules(
      validated.currentQuantity,
      validated.targetStock,
      validated.minStockThreshold,
      unit,
      quantityStep,
      allowFractions
    );

    const updated = pantryService.updateItem(req.user!.id, id, validated);
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

pantryRouter.delete('/pantry/:id', pantryWriteLimit, (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const pantryService = new PantryService(getDatabase());
    pantryService.deleteItem(req.user!.id, id);
    res.json({ success: true, message: `Item ${id} deleted` });
  } catch (err) {
    next(err);
  }
});

pantryRouter.post('/pantry/:id/adjust', pantryWriteLimit, (req: Request, res: Response, next: NextFunction) => {
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

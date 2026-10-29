import Database from 'better-sqlite3';
import { PantryRepository } from '../repositories/PantryRepository.js';
import { PantryItem } from '@shared/types';
import { AppError } from '../middleware/errorHandler.js';

export class PantryService {
  private pantryRepo: PantryRepository;

  constructor(db: Database.Database) {
    this.pantryRepo = new PantryRepository(db);
  }

  getPantry(userId: string): PantryItem[] {
    return this.pantryRepo.getAllByUserId(userId);
  }

  getItem(userId: string, id: string): PantryItem {
    const item = this.pantryRepo.getById(userId, id);
    if (!item) {
      throw new AppError('ITEM_NOT_FOUND', `Pantry item "${id}" not found`, 404);
    }
    return item;
  }

  createItem(userId: string, itemData: Omit<PantryItem, 'stockoutDaysCount'>): PantryItem {
    return this.pantryRepo.create(userId, itemData);
  }

  updateItem(userId: string, id: string, itemData: Partial<PantryItem>): PantryItem {
    const existing = this.getItem(userId, id);
    const updated = {
      ...existing,
      ...itemData,
      id,
    };
    return this.pantryRepo.update(userId, updated);
  }

  deleteItem(userId: string, id: string): void {
    const success = this.pantryRepo.delete(userId, id);
    if (!success) {
      throw new AppError('ITEM_NOT_FOUND', `Pantry item "${id}" not found`, 404);
    }
  }

  adjustQuantity(userId: string, id: string, delta: number): PantryItem {
    const item = this.getItem(userId, id);
    const step = item.quantityStep ?? (['pcs', 'packs', 'units', 'eggs', 'loaf', 'pack', 'dozen'].includes(item.unit.toLowerCase()) ? 1 : 0.5);
    const allowFractions = item.allowFractions ?? !['pcs', 'packs', 'units', 'eggs', 'loaf', 'pack', 'dozen'].includes(item.unit.toLowerCase());

    // Validate delta is a multiple of step
    const stepsRatio = delta / step;
    if (Math.abs(Math.round(stepsRatio) - stepsRatio) > 1e-5) {
      throw new AppError(
        'INVALID_QUANTITY_STEP',
        `Quantity adjustment delta ${delta} must be a multiple of the item's quantity step ${step}`,
        400
      );
    }

    // Validate allowFractions
    if (!allowFractions) {
      const isIntegerDelta = Math.abs(Math.round(delta) - delta) < 1e-5;
      if (!isIntegerDelta) {
        throw new AppError(
          'INVALID_QUANTITY_STEP',
          `Fractional quantities are not allowed for countable item "${item.name}" (${item.unit})`,
          400
        );
      }
    }

    const rawNewQty = item.currentQuantity + delta;
    let newQty = Math.max(0, Math.round(rawNewQty * 1000) / 1000);

    if (!allowFractions) {
      const isIntegerResult = Math.abs(Math.round(newQty) - newQty) < 1e-5;
      if (!isIntegerResult) {
        throw new AppError(
          'INVALID_QUANTITY_STEP',
          `Resulting quantity ${newQty} cannot be fractional for item "${item.name}"`,
          400
        );
      }
      newQty = Math.round(newQty);
    }

    const updated = {
      ...item,
      currentQuantity: newQty,
      stockoutDaysCount: newQty === 0 ? item.stockoutDaysCount : 0,
    };
    return this.pantryRepo.update(userId, updated);
  }
}


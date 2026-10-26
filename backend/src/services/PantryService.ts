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
    const newQty = Math.max(0, Math.round((item.currentQuantity + delta) * 100) / 100);
    const updated = {
      ...item,
      currentQuantity: newQty,
      stockoutDaysCount: newQty === 0 ? item.stockoutDaysCount : 0,
    };
    return this.pantryRepo.update(userId, updated);
  }
}

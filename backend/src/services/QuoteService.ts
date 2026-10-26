import Database from 'better-sqlite3';
import { PantryRepository } from '../repositories/PantryRepository.js';
import { ServerAdapterRegistry, serverAdapterRegistry } from '../adapters/ServerAdapterRegistry.js';
import { StoreProduct } from '@shared/types';

export class QuoteService {
  private pantryRepo: PantryRepository;

  constructor(
    db: Database.Database,
    private adapterRegistry: ServerAdapterRegistry = serverAdapterRegistry
  ) {
    this.pantryRepo = new PantryRepository(db);
  }

  async getQuotesForUser(userId: string): Promise<StoreProduct[]> {
    const items = this.pantryRepo.getAllByUserId(userId);
    return this.adapterRegistry.getAllQuotes(items, userId);
  }

  async getQuotesForPantryItemId(userId: string, itemId: string): Promise<StoreProduct[]> {
    const item = this.pantryRepo.getById(userId, itemId);
    if (!item) return [];
    return this.adapterRegistry.getQuotesForPantryItem(item, userId);
  }
}

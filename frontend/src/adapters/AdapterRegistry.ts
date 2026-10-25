import { StoreId } from '../types';
import { IGroceryStoreAdapter } from './types';
import { BlinkitAdapter } from './BlinkitAdapter';
import { ZeptoAdapter } from './ZeptoAdapter';
import { InstamartAdapter } from './InstamartAdapter';

export class AdapterRegistry {
  private static adapters: Map<StoreId, IGroceryStoreAdapter> = new Map([
    ['blinkit', new BlinkitAdapter()],
    ['zepto', new ZeptoAdapter()],
    ['instamart', new InstamartAdapter()],
  ]);

  public static getAdapter(storeId: StoreId): IGroceryStoreAdapter {
    const adapter = this.adapters.get(storeId);
    if (!adapter) {
      throw new Error(`Grocery adapter for store "${storeId}" not registered.`);
    }
    return adapter;
  }

  public static getAllAdapters(): IGroceryStoreAdapter[] {
    return Array.from(this.adapters.values());
  }

  public static getStoreIds(): StoreId[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Future Integration Boundary:
   * When authorized live credentials/APIs become available, register the live adapter here.
   */
  public static registerLiveAdapter(storeId: StoreId, adapter: IGroceryStoreAdapter): void {
    this.adapters.set(storeId, adapter);
  }
}

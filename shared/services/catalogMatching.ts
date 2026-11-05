import { PantryItem, StoreProduct } from '../types';
import { DEFAULT_PANTRY_ITEMS } from './defaults';

function words(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(word => word.length > 2));
}

/** Match a household pantry item to the demo catalog's canonical pantry identity. */
export function isCatalogProductForPantryItem(product: StoreProduct, item: PantryItem): boolean {
  if (product.pantryItemId === item.id) return true;
  const canonical = DEFAULT_PANTRY_ITEMS.find(candidate => candidate.id === product.pantryItemId);
  if (!canonical || canonical.category !== item.category) return false;
  const itemWords = words(item.name);
  return [...words(canonical.name)].some(word => itemWords.has(word));
}

export function getCatalogProductsForPantryItem(
  item: PantryItem,
  catalog: StoreProduct[],
): StoreProduct[] {
  return catalog.filter(product => isCatalogProductForPantryItem(product, item));
}

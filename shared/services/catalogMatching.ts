import { PantryItem, StoreProduct } from '../types';
import { DEFAULT_PANTRY_ITEMS } from './defaults';

const GENERIC_WORDS = new Set(['fresh', 'whole', 'white', 'pure', 'classic', 'toned', 'farm']);

function words(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter(word => word.length > 2 && !GENERIC_WORDS.has(word)));
}

function matchScore(canonicalName: string, item: PantryItem): number {
  if (item.name.trim().toLowerCase() === canonicalName.trim().toLowerCase()) return Number.MAX_SAFE_INTEGER;
  const itemWords = words(item.name);
  return [...words(canonicalName)].filter(word => itemWords.has(word)).length;
}

/** Match a household pantry item to the closest canonical item represented by the demo catalog. */
export function isCatalogProductForPantryItem(product: StoreProduct, item: PantryItem): boolean {
  if (product.pantryItemId === item.id) return true;
  const canonical = DEFAULT_PANTRY_ITEMS.find(candidate => candidate.id === product.pantryItemId);
  if (!canonical || canonical.category !== item.category) return false;
  const score = matchScore(canonical.name, item);
  if (score === 0) return false;
  const bestScore = Math.max(...DEFAULT_PANTRY_ITEMS
    .filter(candidate => candidate.category === item.category)
    .map(candidate => matchScore(candidate.name, item)));
  return score === bestScore;
}

export function getCatalogProductsForPantryItem(
  item: PantryItem,
  catalog: StoreProduct[],
): StoreProduct[] {
  return catalog.filter(product => isCatalogProductForPantryItem(product, item));
}

/** Build a deterministic mock listing when the demo catalog has no equivalent product. */
export function createHouseholdCatalogProduct(item: PantryItem): StoreProduct {
  return {
    id: `household-${item.id}`,
    storeId: 'blinkit',
    pantryItemId: item.id,
    name: item.name,
    brand: item.preferredBrand || 'Household choice',
    packageSize: item.preferredPackageSize,
    unit: item.unit,
    pricePaise: 10000,
    mrpPaise: 10000,
    inStock: true,
    stockQuantity: 99,
    isExactBrandMatch: true,
  };
}

/**
 * Returns whether a given unit of measurement is countable vs continuous.
 */
export function isCountableUnit(unit: string): boolean {
  const lower = (unit || '').toLowerCase();
  return ['pcs', 'packs', 'units', 'eggs', 'bottles', 'boxes', 'cans', 'loaf', 'pack', 'dozen'].includes(lower);
}

/**
 * Computes the recommended quantity adjustment step.
 * Step 1 for countable units (units, pieces, packs, eggs).
 * Step 0.5 for continuous units (kg, L).
 * Step 50 for g, step 100 for ml.
 */
export function getItemStep(unit: string, customStep?: number): number {
  if (customStep !== undefined && customStep > 0) return customStep;
  const lower = (unit || '').toLowerCase();
  if (isCountableUnit(lower)) return 1;
  if (lower === 'kg' || lower === 'l') return 0.5;
  if (lower === 'g') return 50;
  if (lower === 'ml') return 100;
  return 1;
}

export function formatStockQuantity(qty: number, unit: string): string {
  if (isCountableUnit(unit) || Number.isInteger(qty)) {
    return Math.round(qty).toString();
  }
  return Number(qty.toFixed(2)).toString();
}

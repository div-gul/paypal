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
 * Step 50 for g and ml.
 */
export function getItemStep(unit: string, customStep?: number): number {
  if (customStep !== undefined && customStep > 0) return customStep;
  const lower = (unit || '').toLowerCase();
  if (isCountableUnit(lower)) return 1;
  if (lower === 'kg' || lower === 'l') return 0.5;
  if (lower === 'g') return 50;
  if (lower === 'ml') return 50;
  return 1;
}

/**
 * Keeps an exact package quantity valid against the backend's step validation.
 * For uncommon package sizes, reduce the normal step to a shared decimal divisor.
 */
export function getCompatibleItemStep(unit: string, quantity: number): number {
  const defaultStep = getItemStep(unit);
  if (!Number.isFinite(quantity) || quantity <= 0) return defaultStep;
  const precision = 1000;
  const stepUnits = Math.round(defaultStep * precision);
  const quantityUnits = Math.round(quantity * precision);
  const isMultiple = Math.abs(quantityUnits / stepUnits - Math.round(quantityUnits / stepUnits)) < 1e-5;
  if (isMultiple) return defaultStep;

  let a = stepUnits;
  let b = quantityUnits;
  while (b !== 0) [a, b] = [b, a % b];
  return a / precision;
}

export function formatStockQuantity(qty: number, unit: string): string {
  if (isCountableUnit(unit) || Number.isInteger(qty)) {
    return Math.round(qty).toString();
  }
  return Number(qty.toFixed(2)).toString();
}

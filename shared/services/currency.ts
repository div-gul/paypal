/**
 * Precision Currency Service for ShopPilot AI
 * All internal monetary calculations are conducted in integer Paise (1 INR = 100 Paise)
 * to strictly prevent floating-point rounding inaccuracies.
 */

export function paiseToInr(paise: number): number {
  return paise / 100;
}

export function inrToPaise(inr: number): number {
  return Math.round(inr * 100);
}

export function formatPaise(paise: number, showDecimals: boolean = false): string {
  const inr = paise / 100;
  if (showDecimals || paise % 100 !== 0) {
    return `₹${inr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `₹${inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function calculateGstPaise(subtotalPaise: number, ratePercent: number = 5): number {
  // GST calculated in integer paise
  return Math.round((subtotalPaise * ratePercent) / 100);
}

export function safeSubtractPaise(a: number, b: number): number {
  return Math.max(0, a - b);
}

export interface PaiseToUsdResult {
  usd: string;
  usdCents: number;
  rate: number;
  toString(): string;
}

export const DEFAULT_USD_INR_RATE = 85;

/**
 * Converts integer paise (1 INR = 100 paise) to a USD string with exactly 2 decimal places.
 * Conversion rule: 1 USD = rate INR = (rate * 100) paise.
 * Therefore, 1 US cent = rate paise.
 * Uses integer math, rounding up to the nearest cent so the merchant is never shortchanged.
 *
 * @param paise integer amount in paise (must be non-negative)
 * @param rate INR per 1 USD (defaults to 85)
 */
export function paiseToUsd(paise: number, rate: number = DEFAULT_USD_INR_RATE): PaiseToUsdResult {
  const safePaise = Math.max(0, Math.round(paise));
  const safeRate = rate > 0 ? rate : DEFAULT_USD_INR_RATE;

  // 1 cent = safeRate paise. Round up to the cent:
  const usdCents = safePaise === 0 ? 0 : Math.ceil(safePaise / safeRate);
  const dollars = Math.floor(usdCents / 100);
  const cents = usdCents % 100;
  const usd = `${dollars}.${cents.toString().padStart(2, '0')}`;

  return {
    usd,
    usdCents,
    rate: safeRate,
    toString() {
      return usd;
    },
  };
}

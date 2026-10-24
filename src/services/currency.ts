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

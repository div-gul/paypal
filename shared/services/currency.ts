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

/** Convert the ShopPilot INR basket total to a PayPal USD amount (rounded to cents). */
export function inrPaiseToUsdAmount(amountPaise: number, inrPerUsd: number): string {
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 0) {
    throw new Error('INR amount must be a non-negative integer number of paise.');
  }
  if (!Number.isFinite(inrPerUsd) || inrPerUsd <= 0) {
    throw new Error('INR per USD rate must be greater than zero.');
  }
  const usdCents = Math.round((amountPaise / inrPerUsd));
  return (usdCents / 100).toFixed(2);
}

/** Convert a PayPal USD amount back to its INR paise equivalent for display/checking. */
export function usdAmountToInrPaise(amountUsd: string | number, inrPerUsd: number): number {
  const usd = typeof amountUsd === 'number' ? amountUsd : Number(amountUsd);
  if (!Number.isFinite(usd) || usd < 0 || !/^\d+(\.\d{1,2})?$/.test(String(amountUsd))) {
    throw new Error('USD amount must be a non-negative value with at most two decimal places.');
  }
  if (!Number.isFinite(inrPerUsd) || inrPerUsd <= 0) {
    throw new Error('INR per USD rate must be greater than zero.');
  }
  const usdCents = Math.round(usd * 100);
  return Math.round(usdCents * inrPerUsd);
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

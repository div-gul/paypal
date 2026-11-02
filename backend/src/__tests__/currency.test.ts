import { describe, it, expect } from 'vitest';
import { paiseToUsd } from '@shared/services/currency';

describe('Phase 1: Currency Conversion (paiseToUsd)', () => {
  it('handles zero correctly', () => {
    const res = paiseToUsd(0);
    expect(res.usd).toBe('0.00');
    expect(res.usdCents).toBe(0);
    expect(res.rate).toBe(85);
  });

  it('handles negative or rounded inputs gracefully', () => {
    const res = paiseToUsd(-100);
    expect(res.usd).toBe('0.00');
    expect(res.usdCents).toBe(0);
  });

  it('rounds up to the nearest cent for fractional amounts', () => {
    // 1 paise / 85 = 0.0117... cent -> rounds up to 1 cent ($0.01)
    expect(paiseToUsd(1).usd).toBe('0.01');
    expect(paiseToUsd(1).usdCents).toBe(1);

    // 84 paise / 85 = 0.988... cent -> rounds up to 1 cent ($0.01)
    expect(paiseToUsd(84).usd).toBe('0.01');
    expect(paiseToUsd(84).usdCents).toBe(1);

    // 85 paise / 85 = exact 1 cent ($0.01)
    expect(paiseToUsd(85).usd).toBe('0.01');
    expect(paiseToUsd(85).usdCents).toBe(1);

    // 86 paise / 85 = 1.011... cent -> rounds up to 2 cents ($0.02)
    expect(paiseToUsd(86).usd).toBe('0.02');
    expect(paiseToUsd(86).usdCents).toBe(2);
  });

  it('converts typical grocery order amounts correctly', () => {
    // ₹85 = 8500 paise -> $1.00
    expect(paiseToUsd(8500).usd).toBe('1.00');

    // ₹935.35 = 93535 paise / 85 = 1100.41... -> rounds up to 1101 cents ($11.01)
    expect(paiseToUsd(93535).usd).toBe('11.01');

    // ₹2500 = 250000 paise / 85 = 2941.176... -> 2942 cents ($29.42)
    expect(paiseToUsd(250000).usd).toBe('29.42');
  });

  it('handles very large values without overflow', () => {
    // ₹850,000,000.00 = 85_000_000_000 paise -> $10,000,000.00
    const large = paiseToUsd(85000000000);
    expect(large.usd).toBe('10000000.00');
    expect(large.usdCents).toBe(1000000000);
  });

  it('supports custom exchange rates', () => {
    const res = paiseToUsd(10000, 100); // 10000 paise @ 100 = 100 cents ($1.00)
    expect(res.usd).toBe('1.00');
    expect(res.rate).toBe(100);
  });
});

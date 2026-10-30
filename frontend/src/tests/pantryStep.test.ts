import { isCountableUnit, getItemStep, formatStockQuantity } from '../lib/pantryHelpers';

declare const process: any;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

console.log('\n--- Phase E: Pantry Quantity Steps & Formatting Test ---');

// Test 1: isCountableUnit
assert(isCountableUnit('pcs') === true, 'pcs is countable');
assert(isCountableUnit('packs') === true, 'packs is countable');
assert(isCountableUnit('units') === true, 'units is countable');
assert(isCountableUnit('eggs') === true, 'eggs is countable');
assert(isCountableUnit('bottles') === true, 'bottles is countable');

assert(isCountableUnit('kg') === false, 'kg is continuous');
assert(isCountableUnit('L') === false, 'L is continuous');
assert(isCountableUnit('g') === false, 'g is continuous');
assert(isCountableUnit('ml') === false, 'ml is continuous');

// Test 2: getItemStep
assert(getItemStep('packs') === 1, 'packs step is 1');
assert(getItemStep('eggs') === 1, 'eggs step is 1');
assert(getItemStep('units') === 1, 'units step is 1');

assert(getItemStep('L') === 0.5, 'L step is 0.5');
assert(getItemStep('kg') === 0.5, 'kg step is 0.5');
assert(getItemStep('g') === 50, 'g step is 50');
assert(getItemStep('ml') === 100, 'ml step is 100');

// Custom override step
assert(getItemStep('kg', 0.25) === 0.25, 'custom step override respected');

// Test 3: formatStockQuantity
assert(formatStockQuantity(6, 'eggs') === '6', 'formats 6 eggs as integer');
assert(formatStockQuantity(2, 'packs') === '2', 'formats 2 packs as integer');
assert(formatStockQuantity(1.5, 'L') === '1.5', 'formats 1.5 L with decimal');
assert(formatStockQuantity(0.8, 'kg') === '0.8', 'formats 0.8 kg with decimal');
assert(formatStockQuantity(500, 'g') === '500', 'formats 500 g as integer');

console.log('✅ Phase E Pantry steps and formatting passed successfully!\n');

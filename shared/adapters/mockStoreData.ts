import { StoreId, StoreInfo, StoreProduct } from '../types';

export const STORE_DEFINITIONS: Record<StoreId, StoreInfo> = {
  blinkit: {
    id: 'blinkit',
    name: 'Blinkit',
    brandColor: '#F7CB15',
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
    tagline: 'India’s last minute app (10-12 mins)',
    deliveryFeeBasePaise: 2500, // ₹25
    freeDeliveryThresholdPaise: 49900, // Free delivery above ₹499
    handlingFeePaise: 500, // ₹5
    surgeFeePaise: 0,
    minOrderThresholdPaise: 19900, // ₹199 min order
    estimatedDeliveryMinutes: 12,
  },
  zepto: {
    id: 'zepto',
    name: 'Zepto',
    brandColor: '#7B2CBF',
    badgeBg: 'bg-purple-100 text-purple-900 border-purple-300',
    tagline: 'Groceries delivered in 10 mins',
    deliveryFeeBasePaise: 2000, // ₹20
    freeDeliveryThresholdPaise: 39900, // Free delivery above ₹399
    handlingFeePaise: 400, // ₹4
    surgeFeePaise: 0,
    minOrderThresholdPaise: 14900, // ₹149 min order
    estimatedDeliveryMinutes: 10,
  },
  instamart: {
    id: 'instamart',
    name: 'Swiggy Instamart',
    brandColor: '#FC8019',
    badgeBg: 'bg-orange-100 text-orange-900 border-orange-300',
    tagline: 'Instant grocery by Swiggy (15-20 mins)',
    deliveryFeeBasePaise: 2900, // ₹29
    freeDeliveryThresholdPaise: 49900, // Free delivery above ₹499
    handlingFeePaise: 600, // ₹6
    surgeFeePaise: 0,
    minOrderThresholdPaise: 19900, // ₹199 min order
    estimatedDeliveryMinutes: 16,
  },
};

/**
 * Realistic simulated grocery inventory mapped to pantry item IDs
 */
export const MOCK_STORE_CATALOG: StoreProduct[] = [
  // --- Amul Taaza Milk (pantry item: item-milk) ---
  {
    id: 'bl-milk-1',
    storeId: 'blinkit',
    pantryItemId: 'item-milk',
    name: 'Amul Taaza Homogenised Toned Milk',
    brand: 'Amul',
    packageSize: '1 L',
    unit: 'L',
    pricePaise: 6800, // ₹68.00
    mrpPaise: 7200,
    inStock: true,
    stockQuantity: 42,
    isExactBrandMatch: true,
  },
  {
    id: 'zp-milk-1',
    storeId: 'zepto',
    pantryItemId: 'item-milk',
    name: 'Amul Taaza Homogenised Toned Milk',
    brand: 'Amul',
    packageSize: '1 L',
    unit: 'L',
    pricePaise: 6600, // ₹66.00 (Cheaper on Zepto!)
    mrpPaise: 7200,
    inStock: true,
    stockQuantity: 18,
    isExactBrandMatch: true,
  },
  {
    id: 'im-milk-1',
    storeId: 'instamart',
    pantryItemId: 'item-milk',
    name: 'Mother Dairy Toned Milk (Fresh)',
    brand: 'Mother Dairy', // Substitution brand!
    packageSize: '1 L',
    unit: 'L',
    pricePaise: 6700, // ₹67.00
    mrpPaise: 7000,
    inStock: true,
    stockQuantity: 25,
    isExactBrandMatch: false,
  },

  // --- Whole Wheat Bread (pantry item: item-bread) ---
  {
    id: 'bl-bread-1',
    storeId: 'blinkit',
    pantryItemId: 'item-bread',
    name: 'Harvest Gold 100% Atta Whole Wheat Bread',
    brand: 'Harvest Gold',
    packageSize: '400g',
    unit: 'g',
    pricePaise: 5000, // ₹50.00
    mrpPaise: 5500,
    inStock: true,
    stockQuantity: 15,
    isExactBrandMatch: true,
  },
  {
    id: 'zp-bread-1',
    storeId: 'zepto',
    pantryItemId: 'item-bread',
    name: 'English Oven 100% Whole Wheat Bread',
    brand: 'English Oven', // Alternative brand
    packageSize: '400g',
    unit: 'g',
    pricePaise: 4800, // ₹48.00
    mrpPaise: 5500,
    inStock: true,
    stockQuantity: 30,
    isExactBrandMatch: false,
  },
  {
    id: 'im-bread-1',
    storeId: 'instamart',
    pantryItemId: 'item-bread',
    name: 'Harvest Gold 100% Atta Whole Wheat Bread',
    brand: 'Harvest Gold',
    packageSize: '400g',
    unit: 'g',
    pricePaise: 5200, // ₹52.00
    mrpPaise: 5500,
    inStock: true,
    stockQuantity: 12,
    isExactBrandMatch: true,
  },

  // --- Farm Fresh Eggs (pantry item: item-eggs) ---
  {
    id: 'bl-eggs-1',
    storeId: 'blinkit',
    pantryItemId: 'item-eggs',
    name: 'Eggoz White Farm Eggs (Pack of 6)',
    brand: 'Eggoz',
    packageSize: '6 pcs',
    unit: 'eggs',
    pricePaise: 6200, // ₹62.00
    mrpPaise: 7000,
    inStock: true,
    stockQuantity: 20,
    isExactBrandMatch: true,
  },
  {
    id: 'zp-eggs-1',
    storeId: 'zepto',
    pantryItemId: 'item-eggs',
    name: 'Eggoz White Farm Eggs (Pack of 6)',
    brand: 'Eggoz',
    packageSize: '6 pcs',
    unit: 'eggs',
    pricePaise: 6500, // ₹65.00
    mrpPaise: 7000,
    inStock: true,
    stockQuantity: 14,
    isExactBrandMatch: true,
  },
  {
    id: 'im-eggs-1',
    storeId: 'instamart',
    pantryItemId: 'item-eggs',
    name: 'Eggoz White Farm Eggs (Pack of 6)',
    brand: 'Eggoz',
    packageSize: '6 pcs',
    unit: 'eggs',
    pricePaise: 5900, // ₹59.00 (Cheapest!)
    mrpPaise: 7000,
    inStock: true,
    stockQuantity: 33,
    isExactBrandMatch: true,
  },

  // --- Rolled Oats (pantry item: item-oats) ---
  {
    id: 'bl-oats-1',
    storeId: 'blinkit',
    pantryItemId: 'item-oats',
    name: 'Quaker Rolled Oats 100% Whole Grain',
    brand: 'Quaker',
    packageSize: '1 kg',
    unit: 'kg',
    pricePaise: 18500, // ₹185.00
    mrpPaise: 21000,
    inStock: true,
    stockQuantity: 8,
    isExactBrandMatch: true,
  },
  {
    id: 'zp-oats-1',
    storeId: 'zepto',
    pantryItemId: 'item-oats',
    name: 'Kellogg’s Rolled Oats High Fibre',
    brand: "Kellogg's",
    packageSize: '1 kg',
    unit: 'kg',
    pricePaise: 17900, // ₹179.00
    mrpPaise: 20500,
    inStock: true,
    stockQuantity: 12,
    isExactBrandMatch: false,
  },
  {
    id: 'im-oats-1',
    storeId: 'instamart',
    pantryItemId: 'item-oats',
    name: 'Quaker Rolled Oats 100% Whole Grain',
    brand: 'Quaker',
    packageSize: '1 kg',
    unit: 'kg',
    pricePaise: 18900, // ₹189.00
    mrpPaise: 21000,
    inStock: true,
    stockQuantity: 15,
    isExactBrandMatch: true,
  },

  // --- Nescafe Classic Coffee (pantry item: item-coffee) ---
  {
    id: 'bl-coffee-1',
    storeId: 'blinkit',
    pantryItemId: 'item-coffee',
    name: 'Nescafe Classic 100% Pure Instant Coffee Jar',
    brand: 'Nescafe',
    packageSize: '200g',
    unit: 'g',
    pricePaise: 38000, // ₹380.00
    mrpPaise: 42000,
    inStock: true,
    stockQuantity: 9,
    isExactBrandMatch: true,
  },
  {
    id: 'zp-coffee-1',
    storeId: 'zepto',
    pantryItemId: 'item-coffee',
    name: 'Nescafe Classic 100% Pure Instant Coffee Jar',
    brand: 'Nescafe',
    packageSize: '200g',
    unit: 'g',
    pricePaise: 37500, // ₹375.00
    mrpPaise: 42000,
    inStock: true,
    stockQuantity: 6,
    isExactBrandMatch: true,
  },
  {
    id: 'im-coffee-1',
    storeId: 'instamart',
    pantryItemId: 'item-coffee',
    name: 'Bru Gold 100% Pure Roasted Coffee',
    brand: 'Bru',
    packageSize: '200g',
    unit: 'g',
    pricePaise: 36000, // ₹360.00
    mrpPaise: 41000,
    inStock: true,
    stockQuantity: 18,
    isExactBrandMatch: false,
  },

  // --- Fortune Sunlite Sunflower Oil (pantry item: item-oil) ---
  {
    id: 'bl-oil-1',
    storeId: 'blinkit',
    pantryItemId: 'item-oil',
    name: 'Fortune Sunlite Refined Sunflower Oil Pouch',
    brand: 'Fortune',
    packageSize: '1 L',
    unit: 'L',
    pricePaise: 14500, // ₹145.00
    mrpPaise: 16500,
    inStock: true,
    stockQuantity: 22,
    isExactBrandMatch: true,
  },
  {
    id: 'zp-oil-1',
    storeId: 'zepto',
    pantryItemId: 'item-oil',
    name: 'Fortune Sunlite Refined Sunflower Oil Pouch',
    brand: 'Fortune',
    packageSize: '1 L',
    unit: 'L',
    pricePaise: 14200, // ₹142.00
    mrpPaise: 16500,
    inStock: true,
    stockQuantity: 10,
    isExactBrandMatch: true,
  },
  {
    id: 'im-oil-1',
    storeId: 'instamart',
    pantryItemId: 'item-oil',
    name: 'Saffola Gold Pro Healthy Lifestyle Oil',
    brand: 'Saffola',
    packageSize: '1 L',
    unit: 'L',
    pricePaise: 16500, // ₹165.00
    mrpPaise: 18500,
    inStock: true,
    stockQuantity: 14,
    isExactBrandMatch: false,
  },

  // --- India Gate Basmati Rice (pantry item: item-rice) ---
  {
    id: 'bl-rice-1',
    storeId: 'blinkit',
    pantryItemId: 'item-rice',
    name: 'India Gate Basmati Rice Feast Rozzana',
    brand: 'India Gate',
    packageSize: '5 kg',
    unit: 'kg',
    pricePaise: 44000, // ₹440.00
    mrpPaise: 49500,
    inStock: true,
    stockQuantity: 11,
    isExactBrandMatch: true,
  },
  {
    id: 'zp-rice-1',
    storeId: 'zepto',
    pantryItemId: 'item-rice',
    name: 'Daawat Rozana Super Basmati Rice',
    brand: 'Daawat',
    packageSize: '5 kg',
    unit: 'kg',
    pricePaise: 42500, // ₹425.00
    mrpPaise: 48000,
    inStock: true,
    stockQuantity: 7,
    isExactBrandMatch: false,
  },
  {
    id: 'im-rice-1',
    storeId: 'instamart',
    pantryItemId: 'item-rice',
    name: 'India Gate Basmati Rice Feast Rozzana',
    brand: 'India Gate',
    packageSize: '5 kg',
    unit: 'kg',
    pricePaise: 45000, // ₹450.00
    mrpPaise: 49500,
    inStock: true,
    stockQuantity: 16,
    isExactBrandMatch: true,
  },

  // --- Surf Excel Matic Liquid Detergent (pantry item: item-detergent) ---
  {
    id: 'bl-det-1',
    storeId: 'blinkit',
    pantryItemId: 'item-detergent',
    name: 'Surf Excel Matic Front Load Liquid Detergent Pouch',
    brand: 'Surf Excel',
    packageSize: '2 L',
    unit: 'L',
    pricePaise: 38500, // ₹385.00
    mrpPaise: 45000,
    inStock: true,
    stockQuantity: 10,
    isExactBrandMatch: true,
  },
  {
    id: 'zp-det-1',
    storeId: 'zepto',
    pantryItemId: 'item-detergent',
    name: 'Surf Excel Matic Front Load Liquid Detergent Pouch',
    brand: 'Surf Excel',
    packageSize: '2 L',
    unit: 'L',
    pricePaise: 37900, // ₹379.00
    mrpPaise: 45000,
    inStock: true,
    stockQuantity: 5,
    isExactBrandMatch: true,
  },
  {
    id: 'im-det-1',
    storeId: 'instamart',
    pantryItemId: 'item-detergent',
    name: 'Ariel Matic Front Load Liquid Detergent',
    brand: 'Ariel',
    packageSize: '2 L',
    unit: 'L',
    pricePaise: 39000, // ₹390.00
    mrpPaise: 46000,
    inStock: true,
    stockQuantity: 9,
    isExactBrandMatch: false,
  },
];

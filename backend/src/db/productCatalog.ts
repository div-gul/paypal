import Database from 'better-sqlite3';
import { DEFAULT_PANTRY_ITEMS } from '@shared/services/defaults';
import { MOCK_STORE_CATALOG } from '@shared/adapters/mockStoreData';
import { ProductCategory, StoreId } from '@shared/types';

export interface SeedProduct {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  packageSize: string;
  pricePaise: number;
  platform: StoreId;
  imageUrl?: string;
  available: boolean;
  description?: string;
  pinCode: string;
}

export const DEMO_SERVICE_AREA = {
  name: 'Katraj, Pune',
  pinCode: '411046',
  state: 'Maharashtra',
  country: 'India',
} as const;

const platforms: StoreId[] = ['blinkit', 'zepto', 'instamart'];
const platformPrefix: Record<StoreId, string> = { blinkit: 'bl', zepto: 'zp', instamart: 'im' };

const extraProducts: Array<{
  key: string;
  name: string;
  brand: string;
  category: ProductCategory;
  packageSize: string;
  pricePaise: number;
  description: string;
  imageUrl?: string;
}> = [
  { key: 'butter', name: 'Amul Pasteurised Butter', brand: 'Amul', category: 'Dairy', packageSize: '100 g', pricePaise: 5800, description: 'Salted table butter.', imageUrl: '/products/amul-butter.jpg' },
  { key: 'paneer', name: 'Amul Fresh Paneer', brand: 'Amul', category: 'Dairy', packageSize: '200 g', pricePaise: 9000, description: 'Fresh milk paneer.', imageUrl: '/products/amul-paneer.jpg' },
  { key: 'toor-dal', name: 'Tata Sampann Unpolished Toor Dal', brand: 'Tata Sampann', category: 'Pantry Staples', packageSize: '1 kg', pricePaise: 19000, description: 'Unpolished pigeon peas.', imageUrl: '/products/tata-toor-dal.jpg' },
  { key: 'moong-dal', name: 'Tata Sampann Moong Dal', brand: 'Tata Sampann', category: 'Pantry Staples', packageSize: '1 kg', pricePaise: 17000, description: 'Split yellow moong dal.', imageUrl: '/products/tata-moong-dal.jpg' },
  { key: 'atta', name: 'Aashirvaad Shudh Chakki Atta', brand: 'Aashirvaad', category: 'Pantry Staples', packageSize: '5 kg', pricePaise: 27500, description: 'Whole wheat flour.', imageUrl: '/products/aashirvaad-atta.jpg' },
  { key: 'sugar', name: 'Madhur Pure and Hygienic Sugar', brand: 'Madhur', category: 'Pantry Staples', packageSize: '1 kg', pricePaise: 4900, description: 'Refined white sugar.', imageUrl: '/products/madhur-sugar.jpg' },
  { key: 'salt', name: 'Tata Salt', brand: 'Tata', category: 'Pantry Staples', packageSize: '1 kg', pricePaise: 2700, description: 'Iodised vacuum evaporated salt.', imageUrl: '/products/tata-salt.jpg' },
  { key: 'parle-g', name: 'Parle-G Original Glucose Biscuits', brand: 'Parle', category: 'Snacks', packageSize: '800 g', pricePaise: 9500, description: 'Family pack glucose biscuits.', imageUrl: '/products/parle-g.jpg' },
  { key: 'maggi', name: 'Maggi 2-Minute Masala Noodles', brand: 'Maggi', category: 'Snacks', packageSize: '560 g', pricePaise: 8400, description: 'Eight-pack instant noodles.', imageUrl: '/products/maggi-noodles.jpg' },
  { key: 'tata-tea', name: 'Tata Tea Premium', brand: 'Tata Tea', category: 'Beverages', packageSize: '500 g', pricePaise: 26500, description: 'Black tea blend.', imageUrl: '/products/tata-tea.jpg' },
  { key: 'colgate', name: 'Colgate Strong Teeth Toothpaste', brand: 'Colgate', category: 'Personal Care', packageSize: '200 g', pricePaise: 12500, description: 'Fluoride toothpaste.', imageUrl: '/products/colgate.jpg' },
  { key: 'vim', name: 'Vim Dishwash Liquid', brand: 'Vim', category: 'Household Essentials', packageSize: '750 ml', pricePaise: 13500, description: 'Dishwashing liquid.', imageUrl: '/products/vim-dishwash.jpg' },
];

const additionalProducts: Array<{
  key: string;
  name: string;
  brand: string;
  category: ProductCategory;
  packageSize: string;
  description: string;
  imageUrl?: string;
  offers: Array<{ platform: StoreId; pricePaise: number }>;
}> = [
  { key: 'banana', name: 'Fresh Robusta Bananas', brand: 'Fresh Produce', category: 'Fresh Produce', packageSize: '1 kg', description: 'Fresh whole bananas.', imageUrl: '/products/fresh-bananas.jpg', offers: [{ platform: 'blinkit', pricePaise: 6500 }, { platform: 'zepto', pricePaise: 6200 }] },
  { key: 'apples', name: 'Fresh Shimla Apples', brand: 'Fresh Produce', category: 'Fresh Produce', packageSize: '4 pcs', description: 'Fresh whole apples.', imageUrl: '/products/fresh-apples.jpg', offers: [{ platform: 'zepto', pricePaise: 18900 }, { platform: 'instamart', pricePaise: 19900 }] },
  { key: 'tomatoes', name: 'Fresh Tomatoes', brand: 'Fresh Produce', category: 'Fresh Produce', packageSize: '1 kg', description: 'Fresh red tomatoes.', imageUrl: '/products/fresh-tomatoes.jpg', offers: [{ platform: 'blinkit', pricePaise: 3900 }, { platform: 'instamart', pricePaise: 4200 }] },
  { key: 'potatoes', name: 'Fresh Potatoes', brand: 'Fresh Produce', category: 'Fresh Produce', packageSize: '1 kg', description: 'Fresh potatoes for everyday cooking.', imageUrl: '/products/fresh-potatoes.jpg', offers: [{ platform: 'blinkit', pricePaise: 3200 }, { platform: 'zepto', pricePaise: 3400 }, { platform: 'instamart', pricePaise: 3100 }] },
  { key: 'curd', name: 'Amul Masti Dahi', brand: 'Amul', category: 'Dairy', packageSize: '400 g', description: 'Set curd made from milk.', imageUrl: '/products/amul-dahi.jpg', offers: [{ platform: 'blinkit', pricePaise: 7500 }, { platform: 'zepto', pricePaise: 7800 }, { platform: 'instamart', pricePaise: 7400 }] },
  { key: 'cheese', name: 'Amul Cheese Slices', brand: 'Amul', category: 'Dairy', packageSize: '200 g', description: 'Processed cheese slices.', imageUrl: '/products/amul-cheese.jpg', offers: [{ platform: 'zepto', pricePaise: 14900 }, { platform: 'instamart', pricePaise: 15200 }] },
  { key: 'lays', name: 'Lay’s India’s Magic Masala Chips', brand: 'Lay’s', category: 'Snacks', packageSize: '52 g', description: 'Crispy potato chips with masala seasoning.', imageUrl: '/products/lays-magic-masala.jpg', offers: [{ platform: 'blinkit', pricePaise: 2000 }, { platform: 'zepto', pricePaise: 2000 }, { platform: 'instamart', pricePaise: 2100 }] },
  { key: 'oreo', name: 'Oreo Original Chocolate Sandwich Biscuits', brand: 'Oreo', category: 'Snacks', packageSize: '120 g', description: 'Chocolate biscuits with vanilla-flavoured cream.', imageUrl: '/products/oreo-biscuits.jpg', offers: [{ platform: 'blinkit', pricePaise: 3000 }, { platform: 'zepto', pricePaise: 3200 }] },
  { key: 'haldiram-bhujia', name: 'Haldiram’s Aloo Bhujia', brand: 'Haldiram’s', category: 'Snacks', packageSize: '200 g', description: 'Crispy potato and gram-flour snack.', imageUrl: '/products/haldiram-bhujia.jpg', offers: [{ platform: 'instamart', pricePaise: 6500 }] },
  { key: 'coca-cola', name: 'Coca-Cola Original Taste', brand: 'Coca-Cola', category: 'Beverages', packageSize: '750 ml', description: 'Carbonated soft drink.', imageUrl: '/products/coca-cola.jpg', offers: [{ platform: 'blinkit', pricePaise: 4000 }, { platform: 'zepto', pricePaise: 4200 }, { platform: 'instamart', pricePaise: 3900 }] },
  { key: 'real-juice', name: 'Real Mixed Fruit Juice', brand: 'Real', category: 'Beverages', packageSize: '1 L', description: 'Mixed fruit juice drink.', imageUrl: '/products/real-juice.jpg', offers: [{ platform: 'blinkit', pricePaise: 12500 }, { platform: 'zepto', pricePaise: 12100 }] },
  { key: 'dove-soap', name: 'Dove Cream Beauty Bathing Bar', brand: 'Dove', category: 'Personal Care', packageSize: '3 x 100 g', description: 'Moisturising beauty bathing bars.', imageUrl: '/products/dove-soap.jpg', offers: [{ platform: 'blinkit', pricePaise: 11900 }, { platform: 'instamart', pricePaise: 12300 }] },
  { key: 'harpic', name: 'Harpic Power Plus Toilet Cleaner', brand: 'Harpic', category: 'Household Essentials', packageSize: '1 L', description: 'Liquid toilet bowl cleaner.', imageUrl: '/products/harpic.jpg', offers: [{ platform: 'zepto', pricePaise: 19900 }] },
];

export const SEEDED_PRODUCT_CATALOG: SeedProduct[] = [
  ...MOCK_STORE_CATALOG.map(product => {
    const pantryItem = DEFAULT_PANTRY_ITEMS.find(item => item.id === product.pantryItemId);
    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: pantryItem?.category || 'Pantry Staples',
      packageSize: product.packageSize,
      pricePaise: product.pricePaise,
      platform: product.storeId,
      imageUrl: product.imageUrl,
      available: product.inStock,
      pinCode: DEMO_SERVICE_AREA.pinCode,
    };
  }),
  ...extraProducts.flatMap(product => platforms.map((platform, index) => ({
    id: `${platformPrefix[platform]}-${product.key}`,
    name: product.name,
    brand: product.brand,
    category: product.category,
    packageSize: product.packageSize,
    pricePaise: Math.round(product.pricePaise * [1, 0.97, 1.04][index]),
    platform,
    imageUrl: product.imageUrl,
    available: true,
    description: product.description,
    pinCode: DEMO_SERVICE_AREA.pinCode,
  }))),
  ...additionalProducts.flatMap(product => product.offers.map(offer => ({
    id: `${platformPrefix[offer.platform]}-${product.key}`,
    name: product.name,
    brand: product.brand,
    category: product.category,
    packageSize: product.packageSize,
    pricePaise: offer.pricePaise,
    platform: offer.platform,
    imageUrl: product.imageUrl,
    available: true,
    description: product.description,
    pinCode: DEMO_SERVICE_AREA.pinCode,
  }))),
];

export const SEEDED_PRODUCT_GROUP_COUNT = new Set([
  ...MOCK_STORE_CATALOG.map(product => `pantry:${product.pantryItemId}`),
  ...extraProducts.map(product => `product:${product.key}`),
  ...additionalProducts.map(product => `product:${product.key}`),
]).size;

export function seedProductCatalog(db: Database.Database): void {
  const insert = db.prepare(`
    INSERT INTO product_catalog (
      id, name, brand, category, package_size, price_paise, platform, image_url, available, description, pin_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET image_url = excluded.image_url
  `);
  const seed = db.transaction(() => {
    for (const product of SEEDED_PRODUCT_CATALOG) {
      insert.run(
        product.id,
        product.name,
        product.brand,
        product.category,
        product.packageSize,
        product.pricePaise,
        product.platform,
        product.imageUrl || null,
        product.available ? 1 : 0,
        product.description || null,
        product.pinCode,
      );
    }
  });
  seed();
}

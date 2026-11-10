import { ProductCatalogOffer } from '../api/client';
import { groupCatalogOffers } from '../lib/productCatalog';

declare const process: any;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

const offer = (id: string, productGroupId: string, platform: ProductCatalogOffer['platform']): ProductCatalogOffer => ({
  id, productGroupId, name: 'Toned Milk', brand: 'Amul', category: 'Dairy', packageSize: '500 ml',
  pricePaise: 3000, platform, imageUrl: null, available: true, description: null, pinCode: '411046',
});

const groups = groupCatalogOffers([
  offer('bl-milk', 'milk', 'blinkit'),
  offer('zp-milk', 'milk', 'zepto'),
  offer('im-curd', 'curd', 'instamart'),
]);

assert(groups.length === 2, 'groups platform offers into unique products');
assert(groups.find(group => group.productGroupId === 'milk')?.offers.length === 2, 'keeps all platform offers in one product group');
assert(groups.reduce((total, group) => total + group.offers.length, 0) === 3, 'preserves every offer while grouping');

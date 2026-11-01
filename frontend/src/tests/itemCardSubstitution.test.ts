import { RestockRecommendation, BasketStrategyResult } from '../../../shared/types';

declare const process: any;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

/**
 * Extracts the item card display data from a selected basket strategy.
 * This mirrors the logic in ShoppingAnalysis.tsx and HomeView cards.
 */
function getItemCardBasketData(
  strategy: BasketStrategyResult | null | undefined,
  pantryItemId: string,
  fallbackRec?: RestockRecommendation
) {
  const basketLine = strategy?.storeBaskets
    ?.flatMap(b => b.items.map(i => ({ ...i, storeName: b.storeName, storeId: b.storeId })))
    .find(i => i.product.pantryItemId === pantryItemId);

  if (basketLine) {
    return {
      product: basketLine.product,
      brand: basketLine.product.brand,
      storeName: basketLine.storeName,
      storeId: basketLine.storeId,
      quantity: basketLine.quantity,
      unitPricePaise: basketLine.product.pricePaise,
      totalPaise: basketLine.totalPaise,
      isSubstitution: basketLine.isSubstitution,
      substituteBrand: basketLine.isSubstitution ? basketLine.product.brand : null,
    };
  }

  // Fallback if not scheduled in basket
  return {
    product: fallbackRec?.selectedProduct || null,
    brand: fallbackRec?.selectedProduct?.brand || null,
    storeName: fallbackRec?.selectedStore || null,
    storeId: fallbackRec?.selectedStore || null,
    quantity: fallbackRec?.recommendedQuantity || 0,
    unitPricePaise: fallbackRec?.selectedProduct?.pricePaise || 0,
    totalPaise: (fallbackRec?.recommendedQuantity || 0) * (fallbackRec?.selectedProduct?.pricePaise || 0),
    isSubstitution: Boolean(fallbackRec?.isSubstitution),
    substituteBrand: fallbackRec?.isSubstitution ? fallbackRec.selectedProduct?.brand || null : null,
  };
}

function runItemCardSubstitutionTest() {
  console.log('\nTest: Item Card Basket Line Substitution Display (Requirement 1)');

  // Create a mock strategy where milk has a brand substitution: Mother Dairy from Zepto @ ₹33
  const mockStrategy: BasketStrategyResult = {
    type: 'STRATEGY_B_SINGLE_STORE',
    title: 'Single Store Optimization',
    tag: 'Recommended',
    description: 'Best overall single store order',
    recommendationReason: 'Best overall single store order',
    isRecommended: true,
    totalDiscountPaise: 0,
    totalProductPaise: 3300,
    totalDeliveryFeePaise: 2500,
    totalHandlingFeePaise: 500,
    totalTaxPaise: 165,
    grandTotalPaise: 6465,
    storesInvolvedCount: 1,
    storeBaskets: [
      {
        storeId: 'zepto',
        storeName: 'Zepto',
        productSubtotalPaise: 3300,
        deliveryFeePaise: 2500,
        handlingFeePaise: 500,
        taxPaise: 165,
        minOrderShortfallPaise: 0,
        minOrderThresholdPaise: 0,
        meetsMinOrder: true,
        discountsPaise: 0,
        totalPaise: 6465,
        items: [
          {
            product: {
              id: 'zp-milk-mother-dairy',
              storeId: 'zepto',
              name: 'Mother Dairy Full Cream Milk 1L',
              brand: 'Mother Dairy',
              packageSize: '1 L',
              pricePaise: 3300,
              inStock: true,
              pantryItemId: 'item-milk',
              isExactBrandMatch: false,
              unit: 'L',
              mrpPaise: 3500,
              stockQuantity: 10,
            },
            quantity: 1,
            pantryItemId: 'item-milk',
            totalPaise: 3300,
            isSubstitution: true,
          },
        ],
      },
    ],
  };

  const cardData = getItemCardBasketData(mockStrategy, 'item-milk');

  // Verify the card receives exactly what was selected in the strategy's basket
  assert(cardData.brand === 'Mother Dairy', 'Item card displays substitute brand "Mother Dairy" (not Amul)');
  assert(cardData.storeName === 'Zepto', 'Item card displays fulfilling store "Zepto" (not Blinkit)');
  assert(cardData.quantity === 1, 'Item card displays correct quantity (1)');
  assert(cardData.unitPricePaise === 3300, 'Item card displays basket unit price ₹33.00 (3300 paise)');
  assert(cardData.isSubstitution === true, 'Item card flags isSubstitution as true');
  assert(cardData.substituteBrand === 'Mother Dairy', 'Item card substituteBrand is "Mother Dairy"');

  console.log('✅ Item card substitution test passed successfully!\n');
}

runItemCardSubstitutionTest();

import { ProductCatalogOffer } from '../api/client';

export interface ProductGroup {
  productGroupId: string;
  offers: ProductCatalogOffer[];
}

export function groupCatalogOffers(offers: ProductCatalogOffer[]): ProductGroup[] {
  const groups = new Map<string, ProductCatalogOffer[]>();
  for (const offer of offers) {
    const group = groups.get(offer.productGroupId) || [];
    group.push(offer);
    groups.set(offer.productGroupId, group);
  }
  return Array.from(groups, ([productGroupId, groupedOffers]) => ({ productGroupId, offers: groupedOffers }));
}

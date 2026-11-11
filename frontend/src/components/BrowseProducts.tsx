import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Search, ShoppingBag } from 'lucide-react';
import { ProductCatalogOffer } from '../api/client';
import { api } from '../api/client';
import { useShopPilot } from '../context/ShopPilotContext';
import { groupCatalogOffers } from '../lib/productCatalog';
import { getItemStep, isCountableUnit } from '../lib/pantryHelpers';
import { formatPaise } from '../services/currency';
import { PantryItemFormValues, PantryItemDialog } from './PantryItemDialog';
import { Badge, Button, Card, ProductImage } from './ui';

const PLATFORMS = [
  { id: 'blinkit', label: 'Blinkit' },
  { id: 'zepto', label: 'Zepto' },
  { id: 'instamart', label: 'Instamart' },
] as const;

function packageQuantity(offer: ProductCatalogOffer) {
  const packageText = offer.packageSize.toLowerCase();
  const measured = packageText.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/i);
  if (measured) {
    const unit = measured[2].toLowerCase() === 'l' ? 'L' : measured[2].toLowerCase();
    const quantity = Number(measured[1]);
    let step = getItemStep(unit);
    if (quantity > 0 && Math.abs(quantity / step - Math.round(quantity / step)) > 1e-5) {
      if (quantity % 50 === 0) step = 50;
      else if (quantity % 25 === 0) step = 25;
      else if (quantity % 10 === 0) step = 10;
      else if (Number.isInteger(quantity)) step = 1;
      else step = 0.5;
    }
    return { unit, quantity, step, allowFractions: !isCountableUnit(unit) } as const;
  }
  const pieces = packageText.match(/(\d+)\s*(?:pcs?|pieces?|eggs?)\b/i);
  if (pieces) {
    const unit = /egg/.test(packageText) || /egg/i.test(offer.name) ? 'eggs' : 'pcs';
    const quantity = Number(pieces[1]);
    return { unit, quantity, step: 1, allowFractions: false } as const;
  }
  return { unit: 'packs', quantity: 1, step: 1, allowFractions: false } as const;
}

function initialPantryValues(offer: ProductCatalogOffer): Partial<PantryItemFormValues> {
  const parsed = packageQuantity(offer);
  return {
    name: offer.name,
    category: offer.category,
    preferredBrand: offer.brand,
    preferredPackageSize: offer.packageSize,
    unit: parsed.unit as PantryItemFormValues['unit'],
    currentQuantity: parsed.quantity,
    averageDailyConsumption: 0,
    minStockThreshold: 0,
    targetStock: Math.max(parsed.step, parsed.quantity),
    allowSubstitutions: true,
    requireApprovalForBrandChange: true,
    quantityStep: parsed.step,
    allowFractions: parsed.allowFractions,
  };
}

export const BrowseProducts: React.FC = () => {
  const { pantryItems, addCatalogProduct } = useShopPilot();
  const [offers, setOffers] = useState<ProductCatalogOffer[]>([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [selectedOffer, setSelectedOffer] = useState<ProductCatalogOffer | null>(null);
  const [addingId, setAddingId] = useState('');
  const [success, setSuccess] = useState('');

  const loadCatalog = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await api.getProductCatalog('411046');
      setOffers(response.products);
      setNotice(response.notice);
    } catch (error: any) {
      setLoadError(error?.message || 'The product catalog could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCatalog(); }, []);

  const categories = useMemo(() => Array.from(new Set(offers.map(offer => offer.category))).sort(), [offers]);
  const filteredGroups = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return groupCatalogOffers(offers).flatMap(group => {
      const matchedOffers = group.offers.filter(offer =>
        (platform === 'all' || offer.platform === platform) &&
        (category === 'all' || offer.category === category)
      );
      if (!matchedOffers.length) return [];
      const matchesText = !normalizedSearch || group.offers.some(offer =>
        `${offer.name} ${offer.brand} ${offer.packageSize}`.toLowerCase().includes(normalizedSearch)
      );
      return matchesText ? [{ ...group, visibleOffers: matchedOffers }] : [];
    });
  }, [offers, search, category, platform]);

  const existingProductIds = useMemo(() => new Set(pantryItems.flatMap(item => {
    const keys = [item.id.replace(/^catalog-/, '').replace(/^item-/, '')];
    return keys;
  })), [pantryItems]);
  const isAlreadyInPantry = (offer: ProductCatalogOffer) => existingProductIds.has(offer.productGroupId) || pantryItems.some(item =>
    item.name.trim().toLowerCase() === offer.name.trim().toLowerCase() &&
    item.preferredBrand.trim().toLowerCase() === offer.brand.trim().toLowerCase() &&
    item.preferredPackageSize.trim().toLowerCase() === offer.packageSize.trim().toLowerCase()
  );

  const saveCatalogProduct = async (values: PantryItemFormValues) => {
    if (!selectedOffer) return null;
    setAddingId(selectedOffer.productGroupId);
    setSuccess('');
    const result = await addCatalogProduct(selectedOffer.id, values);
    setAddingId('');
    if (result) {
      setSelectedOffer(null);
      setSuccess(`${result.name} added to your pantry.`);
    }
    return result;
  };

  return (
    <section className="max-w-7xl mx-auto space-y-5" aria-labelledby="browse-products-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="browse-products-title" className="text-xl font-bold text-ink flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-brand" />Browse Products</h2>
          <p className="text-xs text-ink-muted mt-1">Browse demo grocery offers and add household items to your pantry.</p>
        </div>
        <Badge variant="info">Katraj, Pune · 411046</Badge>
      </div>

      <Card className="border-accent/25 bg-accent-tint/30">
        <p className="text-xs leading-relaxed text-ink">{notice || 'Demo catalog for Katraj, Pune – 411046. Prices are illustrative and do not confirm live availability, stock, or delivery coverage.'}</p>
      </Card>

      {success && <p role="status" className="rounded-xl border border-good/30 bg-good/10 px-4 py-3 text-sm text-good">✓ {success}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_190px_190px] gap-3">
        <label className="relative block"><span className="sr-only">Search products</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products or brands" className="w-full pl-9 pr-3 py-2.5 min-h-[44px] rounded-xl border border-secondary-tint bg-surface text-sm text-ink" /></label>
        <label className="text-xs font-medium text-ink-muted">Category<select value={category} onChange={event => setCategory(event.target.value)} className="mt-1 w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-secondary-tint bg-surface text-ink"><option value="all">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs font-medium text-ink-muted">Platform<select value={platform} onChange={event => setPlatform(event.target.value)} className="mt-1 w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-secondary-tint bg-surface text-ink"><option value="all">All platforms</option>{PLATFORMS.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label>
      </div>

      {loading && <p className="py-10 text-center text-sm text-ink-muted">Loading products…</p>}
      {loadError && <Card className="flex items-center justify-between gap-3"><p role="alert" className="flex gap-2 text-sm text-danger"><AlertCircle className="w-4 h-4 shrink-0" />{loadError}</p><Button variant="outline" size="sm" onClick={() => void loadCatalog()}>Retry</Button></Card>}
      {!loading && !loadError && filteredGroups.length === 0 && <Card className="py-10 text-center text-sm text-ink-muted">No products match these filters.</Card>}

      {!loading && !loadError && filteredGroups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredGroups.map(group => {
            const primary = group.visibleOffers[0];
            const inPantry = isAlreadyInPantry(primary);
            return <Card key={group.productGroupId} className="flex flex-col gap-3">
              <div className="flex gap-3">
                <ProductImage src={primary.imageUrl || undefined} alt={primary.name} category={primary.category} size="lg" />
                <div className="min-w-0"><h3 className="font-bold text-sm text-ink">{primary.name}</h3><p className="mt-0.5 text-xs text-ink-muted">{primary.brand} · {primary.packageSize}</p><Badge size="sm" className="mt-2">{primary.category}</Badge></div>
              </div>
              <div className="space-y-2 border-t border-secondary-tint pt-3">
                {group.visibleOffers.map(offer => <div key={offer.id} className="flex items-center justify-between gap-3 text-xs"><span className="text-ink-muted">{PLATFORMS.find(value => value.id === offer.platform)?.label || offer.platform}</span><span className="font-semibold text-ink tabular-nums">{formatPaise(offer.pricePaise)}</span></div>)}
              </div>
              <div className="mt-auto pt-1"><Button className="w-full" size="sm" variant={inPantry ? 'outline' : 'primary'} disabled={inPantry} onClick={() => { setSuccess(''); setSelectedOffer(primary); }}>{inPantry ? 'In Pantry' : 'Add to Pantry'}</Button></div>
            </Card>;
          })}
        </div>
      )}

      {selectedOffer && <PantryItemDialog key={selectedOffer.productGroupId} title={`Add ${selectedOffer.name} to Pantry`} initialValues={initialPantryValues(selectedOffer)} onSave={saveCatalogProduct} onClose={() => { setSelectedOffer(null); setAddingId(''); }} productInformationLocked saveLabel={addingId ? 'Adding…' : 'Add to Pantry'} />}
    </section>
  );
};

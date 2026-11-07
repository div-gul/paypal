import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { PantryItem, ProductCategory, UnitOfMeasurement } from '../types';
import { evaluateItemStockHealth } from '@shared/services/consumptionEngine';
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Shield,
  Layers,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { Card, Button, ProductImage } from './ui';
import { isCountableUnit, getItemStep, formatStockQuantity } from '../lib/pantryHelpers';

const CATEGORIES: ProductCategory[] = [
  'Dairy',
  'Bakery & Bread',
  'Fresh Produce',
  'Beverages',
  'Pantry Staples',
  'Breakfast & Cereals',
  'Snacks',
  'Personal Care',
  'Household',
];

const UNITS: UnitOfMeasurement[] = ['L', 'kg', 'g', 'ml', 'packs', 'pcs', 'units', 'eggs'];

interface PantryManagerProps {
  onOpenSettings?: () => void;
}

export const PantryManager: React.FC<PantryManagerProps> = ({ onOpenSettings }) => {
  const {
    pantryItems,
    updatePantryItem,
    addPantryItem,
    deletePantryItem,
    quickAdjustQuantity,
    schedulerConfig,
  } = useShopPilot();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form state for add/edit modal
  const [formData, setFormData] = useState<Partial<PantryItem>>({
    name: '',
    category: 'Dairy',
    preferredBrand: '',
    preferredPackageSize: '1 L',
    unit: 'L',
    currentQuantity: 1,
    averageDailyConsumption: 0.2,
    minStockThreshold: 1,
    targetStock: 2,
    allowSubstitutions: true,
    requireApprovalForBrandChange: true,
    quantityStep: 0.5,
    allowFractions: true,
  });

  const openEditModal = (item: PantryItem) => {
    setEditingItem(item);
    const isCountable = isCountableUnit(item.unit);
    const step = getItemStep(item.unit, item.quantityStep);
    setFormData({
      ...item,
      quantityStep: step,
      allowFractions: item.allowFractions !== undefined ? item.allowFractions : !isCountable,
    });
    setIsAddingNew(false);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      category: 'Dairy',
      preferredBrand: '',
      preferredPackageSize: '1 L',
      unit: 'L',
      currentQuantity: 1,
      averageDailyConsumption: 0.2,
      minStockThreshold: 1,
      targetStock: 3,
      allowSubstitutions: true,
      requireApprovalForBrandChange: true,
      quantityStep: 0.5,
      allowFractions: true,
    });
    setIsAddingNew(true);
  };

  const handleUnitChange = (newUnit: UnitOfMeasurement) => {
    const isCountable = isCountableUnit(newUnit);
    const step = getItemStep(newUnit);
    setFormData(prev => ({
      ...prev,
      unit: newUnit,
      quantityStep: step,
      allowFractions: !isCountable,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    const unit = (formData.unit as UnitOfMeasurement) || 'units';
    const isCountable = isCountableUnit(unit);
    const quantityStep = getItemStep(unit, formData.quantityStep);
    const allowFractions = formData.allowFractions !== undefined ? formData.allowFractions : !isCountable;

    if (isAddingNew) {
      addPantryItem({
        name: formData.name.trim(),
        category: (formData.category as ProductCategory) || 'Pantry Staples',
        preferredBrand: formData.preferredBrand?.trim() || 'Generic / Local',
        preferredPackageSize: formData.preferredPackageSize?.trim() || '1 Unit',
        unit,
        currentQuantity: Math.max(0, Number(formData.currentQuantity) || 0),
        averageDailyConsumption: Math.max(0, Number(formData.averageDailyConsumption) || 0),
        minStockThreshold: Math.max(0, Number(formData.minStockThreshold) || 0),
        targetStock: Math.max(1, Number(formData.targetStock) || 1),
        allowSubstitutions: !!formData.allowSubstitutions,
        requireApprovalForBrandChange: !!formData.requireApprovalForBrandChange,
        quantityStep,
        allowFractions,
      });
      setIsAddingNew(false);
    } else if (editingItem) {
      updatePantryItem({
        ...editingItem,
        name: formData.name.trim(),
        category: (formData.category as ProductCategory) || editingItem.category,
        preferredBrand: formData.preferredBrand?.trim() || editingItem.preferredBrand,
        preferredPackageSize: formData.preferredPackageSize?.trim() || editingItem.preferredPackageSize,
        unit,
        currentQuantity: Math.max(0, Number(formData.currentQuantity) || 0),
        averageDailyConsumption: Math.max(0, Number(formData.averageDailyConsumption) || 0),
        minStockThreshold: Math.max(0, Number(formData.minStockThreshold) || 0),
        targetStock: Math.max(1, Number(formData.targetStock) || 1),
        allowSubstitutions: !!formData.allowSubstitutions,
        requireApprovalForBrandChange: !!formData.requireApprovalForBrandChange,
        quantityStep,
        allowFractions,
      });
      setEditingItem(null);
    }
  };

  const filteredItems = pantryItems.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.preferredBrand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-secondary-tint pb-4">
        <div>
          <h2 className="text-xl font-bold text-ink flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand" />
            <span>Household Pantry Inventory</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Track daily consumption, set safety thresholds, and keep essentials restocked on autopilot.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSettings}
              icon={<SlidersHorizontal className="w-3.5 h-3.5 text-secondary" />}
            >
              Restock Rules
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={openAddModal}
            icon={<Plus className="w-4 h-4" />}
          >
            Add Item
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search items or preferred brands..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-secondary-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand bg-surface placeholder-ink-muted shadow-soft text-ink min-h-[44px]"
          />
        </div>

        {/* Category Dropdown */}
        <div className="shrink-0">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full sm:w-auto text-xs px-3.5 py-2 rounded-xl border border-secondary-tint bg-surface text-ink font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer shadow-soft min-h-[44px]"
          >
            <option value="all">All Categories ({pantryItems.length})</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pantry Grid Cards */}
      {filteredItems.length === 0 ? (
        <Card variant="default" className="p-12 text-center space-y-3 border-secondary-tint">
          <div className="w-12 h-12 rounded-xl bg-paper flex items-center justify-center mx-auto text-ink-muted border border-secondary-tint">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-ink text-sm">No Pantry Items Found</h3>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              {pantryItems.length === 0
                ? 'Your pantry is currently empty. Add your essential household groceries to enable autonomous tracking.'
                : 'No items match your active search filter.'}
            </p>
          </div>
          {pantryItems.length === 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={openAddModal}
              icon={<Plus className="w-3.5 h-3.5" />}
              className="mt-2"
            >
              Add First Item
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map(item => {
            const health = evaluateItemStockHealth(item, schedulerConfig.urgentThresholdDays);
            const isStockout = item.currentQuantity <= 0;
            const isBelowSafety = !isStockout && item.currentQuantity <= item.minStockThreshold;

            const step = getItemStep(item.unit, item.quantityStep);

            return (
              <div
                key={item.id}
                className={`bg-surface rounded-2xl border p-4 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between ${
                  isStockout
                    ? 'border-danger/40 bg-danger/5 ring-1 ring-danger/20'
                    : isBelowSafety
                    ? 'border-accent/40 bg-accent-tint/30 ring-1 ring-accent/20'
                    : 'border-secondary-tint/70 hover:border-brand/30'
                }`}
              >
                {/* Top Section */}
                <div className="space-y-3">
                  {/* Category and Health Badge with icon and text label */}
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-extrabold text-ink-muted uppercase tracking-widest">
                      {item.category}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        isStockout
                          ? 'bg-danger/10 text-danger border border-danger/25'
                          : isBelowSafety
                          ? 'bg-accent-tint text-accent-dark border border-accent/25'
                          : 'bg-good/15 text-good border border-good/30'
                      }`}
                    >
                      {isStockout || isBelowSafety ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-current shrink-0" />
                      ) : (
                        <CheckCircle className="w-3.5 h-3.5 text-good shrink-0" />
                      )}
                      <span>{health.daysRemainingText}</span>
                    </span>
                  </div>

                  {/* Item Name & Preferred Brand with Thumbnail */}
                  <div className="flex items-start gap-3">
                    <ProductImage
                      src={item.imageUrl}
                      alt={item.name}
                      category={item.category}
                      size="md"
                      className="shrink-0 rounded-xl border border-secondary-tint/60 shadow-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <h3
                        className="font-bold text-ink text-sm sm:text-base leading-snug line-clamp-2"
                        title={item.name}
                      >
                        {item.name}
                      </h3>
                      <div className="text-xs text-ink-muted flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-secondary-tint/50 text-[11px] font-medium text-ink">
                          {item.preferredBrand}
                        </span>
                        <span className="text-[11px] text-ink-muted">• {item.preferredPackageSize}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Middle Section: Stock Level Box */}
                <div className="my-3.5 py-3 px-3.5 rounded-xl bg-paper/80 border border-secondary-tint/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-ink-muted block uppercase font-bold tracking-wider">
                        In Pantry
                      </span>
                      <div className="text-2xl font-black text-ink tabular-nums leading-none mt-1 tracking-tight">
                        {formatStockQuantity(item.currentQuantity, item.unit)}{' '}
                        <span className="text-xs font-bold text-ink-muted">{item.unit}</span>
                      </div>
                    </div>

                    {/* Quick Quantity Adjusters with Unit-Aware Step */}
                    <div className="inline-flex items-center bg-surface border border-secondary-tint rounded-xl p-0.5 shadow-xs">
                      <button
                        onClick={() => quickAdjustQuantity(item.id, -step)}
                        title={`Consume ${step} ${item.unit}`}
                        className="w-8 h-8 rounded-lg text-ink font-bold text-sm flex items-center justify-center hover:bg-secondary-tint/70 active:scale-95 cursor-pointer transition"
                      >
                        −
                      </button>
                      <div className="w-px h-4 bg-secondary-tint mx-0.5" />
                      <button
                        onClick={() => quickAdjustQuantity(item.id, step)}
                        title={`Restock ${step} ${item.unit}`}
                        className="w-8 h-8 rounded-lg text-brand font-bold text-sm flex items-center justify-center hover:bg-brand-tint active:scale-95 cursor-pointer transition"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Burn rate and safety threshold chips */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-secondary-tint/50">
                    <div className="bg-surface/70 rounded-lg p-2 border border-secondary-tint/40">
                      <span className="text-ink-muted block text-[9px] uppercase font-bold tracking-wider">Burn Rate</span>
                      <span className="font-bold text-ink tabular-nums text-xs mt-0.5 block">
                        {item.averageDailyConsumption} <span className="text-[10px] font-normal text-ink-muted">{item.unit}/day</span>
                      </span>
                    </div>
                    <div className="bg-surface/70 rounded-lg p-2 border border-secondary-tint/40">
                      <span className="text-ink-muted block text-[9px] uppercase font-bold tracking-wider">Safety Min</span>
                      <span className="font-bold text-ink tabular-nums text-xs mt-0.5 block">
                        {item.minStockThreshold} <span className="text-[10px] font-normal text-ink-muted">{item.unit}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Aligned Uniform Row Height Across All Cards */}
                <div className="mt-auto pt-2.5 flex items-center justify-between min-h-[40px] border-t border-secondary-tint/60 text-xs">
                  {/* Left: Brand swap policy pill */}
                  <div>
                    {item.requireApprovalForBrandChange ? (
                      <span
                        title="ShopPilot will ask you before ordering an alternate brand"
                        className="text-[11px] font-semibold text-secondary bg-secondary-tint/80 border border-secondary/20 px-2.5 py-1 rounded-full flex items-center gap-1.5"
                      >
                        <Shield className="w-3.5 h-3.5 text-secondary shrink-0" />
                        <span>Ask before swap</span>
                      </span>
                    ) : item.allowSubstitutions ? (
                      <span
                        title="Automatic brand substitutions allowed"
                        className="text-[11px] font-medium text-ink-muted bg-paper border border-secondary-tint px-2.5 py-1 rounded-full"
                      >
                        Auto-swap
                      </span>
                    ) : (
                      <span
                        title="Only exact brand permitted"
                        className="text-[11px] font-semibold text-brand bg-brand-tint border border-brand/20 px-2.5 py-1 rounded-full"
                      >
                        Exact brand
                      </span>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(item)}
                      title="Edit item settings"
                      className="w-8 h-8 rounded-lg text-ink-muted hover:text-ink hover:bg-secondary-tint/60 cursor-pointer transition flex items-center justify-center"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deletePantryItem(item.id)}
                      title="Delete item"
                      className="w-8 h-8 rounded-lg text-ink-muted hover:text-danger hover:bg-danger/10 cursor-pointer transition flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Add Item Modal */}
      {(isAddingNew || editingItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-xl max-w-lg w-full p-6 shadow-card border border-secondary-tint max-h-[90vh] overflow-y-auto space-y-4">
            <h3 className="text-base font-bold text-ink">
              {isAddingNew ? 'Add Household Pantry Essential' : `Edit ${editingItem?.name}`}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="space-y-3">
                <div>
                  <label className="block text-ink font-semibold mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Toned Fresh Milk"
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl border-secondary-tint bg-surface text-ink focus-visible:ring-brand min-h-[44px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-ink font-semibold mb-1">Category</label>
                    <select
                      value={formData.category || 'Dairy'}
                      onChange={e => setFormData({ ...formData, category: e.target.value as ProductCategory })}
                      className="w-full px-3 py-2 border rounded-xl border-secondary-tint bg-surface text-ink min-h-[44px]"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-ink font-semibold mb-1">Unit of Measurement</label>
                    <select
                      value={formData.unit || 'L'}
                      onChange={e => handleUnitChange(e.target.value as UnitOfMeasurement)}
                      className="w-full px-3 py-2 border rounded-xl border-secondary-tint bg-surface text-ink min-h-[44px]"
                    >
                      {UNITS.map(u => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-ink font-semibold mb-1">Preferred Brand</label>
                    <input
                      type="text"
                      placeholder="e.g., Amul"
                      value={formData.preferredBrand || ''}
                      onChange={e => setFormData({ ...formData, preferredBrand: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl border-secondary-tint bg-surface text-ink min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-ink font-semibold mb-1">Preferred Package Size</label>
                    <input
                      type="text"
                      placeholder="e.g., 500 ml pouch"
                      value={formData.preferredPackageSize || ''}
                      onChange={e => setFormData({ ...formData, preferredPackageSize: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl border-secondary-tint bg-surface text-ink min-h-[44px]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-ink font-semibold">Product Image URL (Optional)</label>
                    {formData.imageUrl && (
                      <span className="text-[10px] text-brand font-medium">Image preview active</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/... or image link"
                      value={formData.imageUrl || ''}
                      onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="flex-1 px-3 py-2 border rounded-xl border-secondary-tint bg-surface text-ink min-h-[44px]"
                    />
                    {formData.imageUrl && (
                      <ProductImage
                        src={formData.imageUrl}
                        alt={formData.name || 'Preview'}
                        category={formData.category}
                        size="sm"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Consumption and Thresholds */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-secondary-tint">
                <div>
                  <label className="block text-ink font-semibold mb-1">Current Stock</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={formData.currentQuantity ?? 0}
                    onChange={e => setFormData({ ...formData, currentQuantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-xl border-secondary-tint bg-surface text-ink tabular-nums min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-ink font-semibold mb-1">Daily Burn Rate</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={formData.averageDailyConsumption ?? 0.1}
                    onChange={e => setFormData({ ...formData, averageDailyConsumption: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-xl border-secondary-tint bg-surface text-ink tabular-nums min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-ink font-semibold mb-1">Min Safe Stock</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={formData.minStockThreshold ?? 1}
                    onChange={e => setFormData({ ...formData, minStockThreshold: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-xl border-secondary-tint bg-surface text-ink tabular-nums min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-ink font-semibold mb-1">Target Restock</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={formData.targetStock ?? 2}
                    onChange={e => setFormData({ ...formData, targetStock: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-xl border-secondary-tint bg-surface text-ink tabular-nums min-h-[44px]"
                  />
                </div>
              </div>

              {/* Single Brand Swap Approval Toggle */}
              <div className="pt-2 border-t border-secondary-tint">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-secondary-tint hover:bg-paper transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!formData.requireApprovalForBrandChange}
                    onChange={e => {
                      const checked = e.target.checked;
                      setFormData({
                        ...formData,
                        requireApprovalForBrandChange: checked,
                        allowSubstitutions: true,
                      });
                    }}
                    className="mt-0.5 rounded text-brand focus:ring-brand w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-ink text-xs block">
                      Ask before swapping brands
                    </span>
                    <span className="text-[11px] text-ink-muted block leading-tight mt-0.5">
                      When checked, ShopPilot will always ask for your confirmation if substituting an alternate brand.
                    </span>
                  </div>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-secondary-tint flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingItem(null);
                  }}
                >
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Save Item
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

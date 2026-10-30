import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { PantryItem, ProductCategory, UnitOfMeasurement } from '../types';
import { evaluateItemStockHealth } from '../services/consumptionEngine';
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
import { Card, Button } from './ui';

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
import { isCountableUnit, getItemStep, formatStockQuantity } from '../lib/pantryHelpers';

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-heading flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-600" />
            <span>Household Pantry Inventory</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track daily consumption, set safety thresholds, and keep essentials restocked on autopilot.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSettings}
              icon={<SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />}
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
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search items or preferred brands..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white placeholder-slate-400 shadow-2xs"
          />
        </div>

        {/* Category Dropdown */}
        <div className="shrink-0">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full sm:w-auto text-xs px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer shadow-2xs"
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
        <Card variant="default" className="p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-sm font-heading">No Pantry Items Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
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
                className={`bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-md transition-all duration-150 flex flex-col justify-between ${
                  isStockout
                    ? 'border-rose-300 bg-rose-50/20'
                    : isBelowSafety
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-slate-200'
                }`}
              >
                {/* Top Section */}
                <div className="space-y-2">
                  {/* Category and Health Badge */}
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {item.category}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        health.badgeColor === 'red' || health.badgeColor === 'rose'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : health.badgeColor === 'amber'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {isStockout || isBelowSafety ? (
                        <AlertTriangle className="w-3 h-3 text-current" />
                      ) : (
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                      )}
                      {health.daysRemainingText}
                    </span>
                  </div>

                  {/* Item Name & Preferred Brand */}
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-snug font-heading">
                      {item.name}
                    </h3>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>
                        Brand: <strong className="text-slate-700">{item.preferredBrand}</strong>
                      </span>
                      <span>•</span>
                      <span>{item.preferredPackageSize}</span>
                    </div>
                  </div>
                </div>

                {/* Middle Section: Stock Level Box */}
                <div className="my-3 py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                        In Pantry
                      </span>
                      <div className="text-lg font-extrabold text-slate-900 font-sans tabular-nums leading-none mt-0.5">
                        {formatStockQuantity(item.currentQuantity, item.unit)}{' '}
                        <span className="text-xs font-semibold text-slate-500">{item.unit}</span>
                      </div>
                    </div>

                    {/* Quick Quantity Adjusters with Unit-Aware Step */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => quickAdjustQuantity(item.id, -step)}
                        title={`Consume ${step} ${item.unit}`}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 text-slate-700 font-extrabold text-sm flex items-center justify-center cursor-pointer transition shadow-2xs"
                      >
                        -
                      </button>
                      <button
                        onClick={() => quickAdjustQuantity(item.id, step)}
                        title={`Add ${step} ${item.unit}`}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 text-slate-700 font-extrabold text-sm flex items-center justify-center cursor-pointer transition shadow-2xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Burn rate and safety threshold */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1.5 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold">Burn Rate</span>
                      <span className="font-semibold text-slate-700 font-sans tabular-nums">
                        {item.averageDailyConsumption} {item.unit}/day
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold">Safety Min</span>
                      <span className="font-semibold text-slate-700 font-sans tabular-nums">
                        {item.minStockThreshold} {item.unit}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Aligned Uniform Row Height Across All Cards */}
                <div className="mt-auto pt-2.5 flex items-center justify-between min-h-[38px] border-t border-slate-100 text-xs">
                  {/* Left: Brand swap policy pill */}
                  <div>
                    {item.requireApprovalForBrandChange ? (
                      <span
                        title="ShopPilot will ask you before ordering an alternate brand"
                        className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1"
                      >
                        <Shield className="w-3 h-3 text-amber-600" /> Ask before swap
                      </span>
                    ) : item.allowSubstitutions ? (
                      <span
                        title="Automatic brand substitutions allowed"
                        className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full"
                      >
                        Auto-swap
                      </span>
                    ) : (
                      <span
                        title="Only exact brand permitted"
                        className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full"
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
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deletePantryItem(item.id)}
                      title="Delete item"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition"
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <h3 className="text-base font-bold text-slate-900 font-heading">
              {isAddingNew ? 'Add Household Pantry Item' : `Edit ${editingItem?.name}`}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl border-slate-300 focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. Fresh Toned Milk"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as ProductCategory })}
                    className="w-full px-3 py-2 border rounded-xl border-slate-300"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unit of Measurement</label>
                  <select
                    value={formData.unit}
                    onChange={e => handleUnitChange(e.target.value as UnitOfMeasurement)}
                    className="w-full px-3 py-2 border rounded-xl border-slate-300"
                  >
                    {UNITS.map(u => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Preferred Brand</label>
                  <input
                    type="text"
                    value={formData.preferredBrand || ''}
                    onChange={e => setFormData({ ...formData, preferredBrand: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl border-slate-300"
                    placeholder="e.g. Amul, Quaker, Nescafe"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Preferred Package Size</label>
                  <input
                    type="text"
                    value={formData.preferredPackageSize || ''}
                    onChange={e => setFormData({ ...formData, preferredPackageSize: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl border-slate-300"
                    placeholder="e.g. 1 L, 500g, Pack of 6"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Current Stock</label>
                  <input
                    type="number"
                    step={formData.quantityStep ?? 1}
                    inputMode={formData.allowFractions ? 'decimal' : 'numeric'}
                    min="0"
                    value={formData.currentQuantity ?? 0}
                    onChange={e => setFormData({ ...formData, currentQuantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-xl border-slate-300 font-sans tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Daily Burn Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    min="0"
                    value={formData.averageDailyConsumption ?? 0}
                    onChange={e => setFormData({ ...formData, averageDailyConsumption: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-xl border-slate-300 font-sans tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Min Safe Stock</label>
                  <input
                    type="number"
                    step={formData.quantityStep ?? 1}
                    inputMode={formData.allowFractions ? 'decimal' : 'numeric'}
                    min="0"
                    value={formData.minStockThreshold ?? 0}
                    onChange={e => setFormData({ ...formData, minStockThreshold: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-xl border-slate-300 font-sans tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Target Restock</label>
                  <input
                    type="number"
                    step={formData.quantityStep ?? 1}
                    inputMode={formData.allowFractions ? 'decimal' : 'numeric'}
                    min={formData.quantityStep ?? 1}
                    value={formData.targetStock ?? 1}
                    onChange={e => setFormData({ ...formData, targetStock: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-xl border-slate-300 font-sans tabular-nums"
                  />
                </div>
              </div>

              {/* Single Brand Swap Approval Toggle */}
              <div className="pt-2 border-t border-slate-200">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer">
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
                    className="mt-0.5 rounded text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-slate-900 text-xs block">
                      Ask before swapping brands
                    </span>
                    <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                      When checked, ShopPilot will always ask for your confirmation if substituting an alternate brand.
                    </span>
                  </div>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <Button
                  variant="ghost"
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

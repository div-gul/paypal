import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { PantryItem, ProductCategory, UnitOfMeasurement } from '../types';
import {
  evaluateItemStockHealth,
} from '../services/consumptionEngine';
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Shield,
  Layers,
  Search,
} from 'lucide-react';

const CATEGORIES: ProductCategory[] = [
  'Dairy',
  'Bakery & Bread',
  'Fresh Produce',
  'Beverages',
  'Pantry Staples',
  'Breakfast & Cereals',
  'Snacks',
  'Personal Care',
];

const UNITS: UnitOfMeasurement[] = ['L', 'kg', 'g', 'ml', 'packs', 'pcs', 'units', 'eggs'];

export const PantryManager: React.FC = () => {
  const {
    pantryItems,
    updatePantryItem,
    addPantryItem,
    deletePantryItem,
    quickAdjustQuantity,
    schedulerConfig,
    recommendations,
    includeInWeeklyBasket,
    removeFromBasket,
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
  });

  const openEditModal = (item: PantryItem) => {
    setEditingItem(item);
    setFormData(item);
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
    });
    setIsAddingNew(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    if (isAddingNew) {
      addPantryItem({
        name: formData.name.trim(),
        category: (formData.category as ProductCategory) || 'Pantry Staples',
        preferredBrand: formData.preferredBrand?.trim() || 'Generic / Local',
        preferredPackageSize: formData.preferredPackageSize?.trim() || '1 Unit',
        unit: (formData.unit as UnitOfMeasurement) || 'units',
        currentQuantity: Math.max(0, Number(formData.currentQuantity) || 0),
        averageDailyConsumption: Math.max(0, Number(formData.averageDailyConsumption) || 0),
        minStockThreshold: Math.max(0, Number(formData.minStockThreshold) || 0),
        targetStock: Math.max(1, Number(formData.targetStock) || 1),
        allowSubstitutions: !!formData.allowSubstitutions,
        requireApprovalForBrandChange: !!formData.requireApprovalForBrandChange,
      });
      setIsAddingNew(false);
    } else if (editingItem) {
      updatePantryItem({
        ...editingItem,
        name: formData.name.trim(),
        category: (formData.category as ProductCategory) || editingItem.category,
        preferredBrand: formData.preferredBrand?.trim() || editingItem.preferredBrand,
        preferredPackageSize: formData.preferredPackageSize?.trim() || editingItem.preferredPackageSize,
        unit: (formData.unit as UnitOfMeasurement) || editingItem.unit,
        currentQuantity: Math.max(0, Number(formData.currentQuantity) || 0),
        averageDailyConsumption: Math.max(0, Number(formData.averageDailyConsumption) || 0),
        minStockThreshold: Math.max(0, Number(formData.minStockThreshold) || 0),
        targetStock: Math.max(1, Number(formData.targetStock) || 1),
        allowSubstitutions: !!formData.allowSubstitutions,
        requireApprovalForBrandChange: !!formData.requireApprovalForBrandChange,
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
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-600" />
            Consumption-Aware Household Pantry
          </h2>
          <p className="text-xs text-slate-500">
            Estimated inventory and daily burn rates configured by the user. (Not physically sensed)
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Household Item
        </button>
      </div>

      {/* Realistic Assumption Notice Badge */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
        <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong>User Estimation Disclaimer:</strong> All pantry quantities and depletion schedules are calculated from user-configured inventory levels and average daily consumption rates (
          <code className="text-amber-800 bg-amber-100/60 px-1 py-0.5 rounded font-mono text-[11px]">
            Days Remaining = Current Qty / Daily Consumption
          </code>
          ).
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search items or brands..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
        >
          <option value="all">All Categories ({pantryItems.length})</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Pantry Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {filteredItems.map(item => {
          const health = evaluateItemStockHealth(item, schedulerConfig.urgentThresholdDays);
          const rec = recommendations.find(r => r.itemId === item.id);
          const isInBasket =
            (rec?.outcome === 'RESTOCK_NOW' || rec?.outcome === 'INCLUDE_IN_WEEKLY_BASKET' || rec?.approvalStatus === 'approved') &&
            (rec?.recommendedQuantity || 0) > 0;

          const isStockout = item.currentQuantity <= 0;
          const isBelowSafety = !isStockout && item.currentQuantity <= item.minStockThreshold;

          return (
            <div
              key={item.id}
              className={`bg-white rounded-xl border p-4 shadow-2xs hover:shadow-md transition flex flex-col justify-between ${
                isStockout
                  ? 'border-red-300 bg-red-50/20'
                  : isBelowSafety
                  ? 'border-amber-300 bg-amber-50/20'
                  : 'border-slate-200'
              }`}
            >
              {/* Card Header: Category & Health Badge */}
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    {item.category}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      health.badgeColor === 'red'
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : health.badgeColor === 'rose'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : health.badgeColor === 'amber'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    {isStockout ? (
                      <AlertTriangle className="w-3 h-3 text-red-600" />
                    ) : isBelowSafety ? (
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                    ) : (
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                    )}
                    {health.daysRemainingText}
                  </span>
                </div>

                {/* Item Name & Preferred Brand */}
                <h3 className="font-bold text-slate-900 text-sm leading-snug">{item.name}</h3>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span>
                    Brand: <strong className="text-slate-700">{item.preferredBrand}</strong>
                  </span>
                  <span>•</span>
                  <span>{item.preferredPackageSize}</span>
                </div>
              </div>

              {/* Stock Level & Quick Adjust */}
              <div className="my-3 py-2.5 px-3 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">In Pantry</span>
                    <div className="text-base font-extrabold text-slate-900 font-mono">
                      {item.currentQuantity} <span className="text-xs font-medium text-slate-500">{item.unit}</span>
                    </div>
                  </div>

                  {/* Quick Quantity Adjusters */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => quickAdjustQuantity(item.id, -0.5)}
                      title="Consume 0.5 units"
                      className="w-6 h-6 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <button
                      onClick={() => quickAdjustQuantity(item.id, 0.5)}
                      title="Add 0.5 units"
                      className="w-6 h-6 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Consumption & Target specs */}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200/70">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Burn Rate</span>
                    <span className="font-semibold text-slate-700">
                      {item.averageDailyConsumption} {item.unit}/day
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Min / Target</span>
                    <span className="font-semibold text-slate-700">
                      {item.minStockThreshold} / {item.targetStock} {item.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Policy Badges & Actions */}
              <div className="pt-1 flex items-center justify-between gap-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span
                    title={item.allowSubstitutions ? 'Substitutions permitted' : 'Exact brand required'}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      item.allowSubstitutions
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-purple-100 text-purple-700 font-bold'
                    }`}
                  >
                    {item.allowSubstitutions ? 'Subs OK' : 'Strict Brand'}
                  </span>
                  {item.requireApprovalForBrandChange && (
                    <span
                      title="Approval required before changing brands"
                      className="text-amber-700 font-medium flex items-center text-[10px]"
                    >
                      <Shield className="w-3 h-3 mr-0.5 text-amber-500" /> Req Approval
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {isInBasket ? (
                    <button
                      onClick={() => removeFromBasket(item.id)}
                      title="Item is scheduled in restock basket. Click to remove."
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 cursor-pointer hover:bg-emerald-200"
                    >
                      <CheckCircle className="w-3 h-3 text-emerald-600" /> In Basket
                    </button>
                  ) : (
                    <button
                      onClick={() => includeInWeeklyBasket(item.id)}
                      title="Add this item to the restock basket"
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-600 border border-slate-200 flex items-center gap-1 cursor-pointer transition"
                    >
                      <Plus className="w-3 h-3 text-brand-600" /> + Add to Basket
                    </button>
                  )}

                  <button
                    onClick={() => openEditModal(item)}
                    title="Edit pantry settings"
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deletePantryItem(item.id)}
                    title="Delete item"
                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Add Modal */}
      {(isAddingNew || editingItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 mb-4">
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
                    className="w-full px-3 py-2 border rounded-lg border-slate-300 focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. Fresh Toned Milk"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as ProductCategory })}
                    className="w-full px-3 py-2 border rounded-lg border-slate-300"
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
                    onChange={e => setFormData({ ...formData, unit: e.target.value as UnitOfMeasurement })}
                    className="w-full px-3 py-2 border rounded-lg border-slate-300"
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
                    className="w-full px-3 py-2 border rounded-lg border-slate-300"
                    placeholder="e.g. Amul, Quaker, Nescafe"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Preferred Package Size</label>
                  <input
                    type="text"
                    value={formData.preferredPackageSize || ''}
                    onChange={e => setFormData({ ...formData, preferredPackageSize: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg border-slate-300"
                    placeholder="e.g. 1 L, 500g, Pack of 6"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Current Stock</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.currentQuantity ?? 0}
                    onChange={e => setFormData({ ...formData, currentQuantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Daily Burn Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.averageDailyConsumption ?? 0}
                    onChange={e => setFormData({ ...formData, averageDailyConsumption: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Min Safe Stock</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.minStockThreshold ?? 0}
                    onChange={e => setFormData({ ...formData, minStockThreshold: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Target Restock</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={formData.targetStock ?? 1}
                    onChange={e => setFormData({ ...formData, targetStock: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-lg border-slate-300"
                  />
                </div>
              </div>

              {/* Policy Toggles */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!formData.allowSubstitutions}
                    onChange={e => setFormData({ ...formData, allowSubstitutions: e.target.checked })}
                    className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                  />
                  <span className="font-semibold text-slate-700">Allow brand substitutions if out of stock</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!formData.requireApprovalForBrandChange}
                    onChange={e => setFormData({ ...formData, requireApprovalForBrandChange: e.target.checked })}
                    className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                  />
                  <span className="font-semibold text-slate-700">
                    Require explicit user approval before switching to an alternate brand
                  </span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold cursor-pointer shadow-xs"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

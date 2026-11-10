import React, { useState } from 'react';
import { PantryItem, ProductCategory, UnitOfMeasurement } from '@shared/types';
import { Button } from './ui/Button';
import { getItemStep, isCountableUnit } from '../lib/pantryHelpers';

export type PantryItemFormValues = Omit<PantryItem, 'id' | 'lastRestockedDate' | 'stockoutDaysCount'>;

interface Props {
  title: string;
  initialValues: Partial<PantryItemFormValues>;
  onSave: (values: PantryItemFormValues) => Promise<PantryItem | null | void>;
  onClose: () => void;
  productInformationLocked?: boolean;
  saveLabel?: string;
}

const CATEGORIES: ProductCategory[] = [
  'Dairy', 'Bakery & Bread', 'Fresh Produce', 'Beverages', 'Pantry Staples',
  'Breakfast & Cereals', 'Snacks', 'Personal Care', 'Household', 'Household Essentials',
];
const UNITS: UnitOfMeasurement[] = ['L', 'kg', 'g', 'ml', 'packs', 'pcs', 'units', 'eggs'];

export const PantryItemDialog: React.FC<Props> = ({
  title,
  initialValues,
  onSave,
  onClose,
  productInformationLocked = false,
  saveLabel = 'Save Item',
}) => {
  const [formData, setFormData] = useState<PantryItemFormValues>(() => {
    const values: PantryItemFormValues = {
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
      ...initialValues,
    };
    return {
      ...values,
      quantityStep: getItemStep(values.unit, values.quantityStep),
      allowFractions: initialValues.allowFractions ?? !isCountableUnit(values.unit),
    };
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleUnitChange = (unit: UnitOfMeasurement) => {
    const countable = isCountableUnit(unit);
    setFormData(previous => ({
      ...previous,
      unit,
      quantityStep: getItemStep(unit),
      allowFractions: !countable,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name.trim()) return;
    setIsSaving(true);
    setSaveError('');
    const unit = formData.unit || 'units';
    const countable = isCountableUnit(unit);
    const quantityStep = getItemStep(unit, formData.quantityStep);
    try {
      const result = await onSave({
        ...formData,
        category: formData.category || 'Pantry Staples',
        preferredBrand: formData.preferredBrand.trim() || 'Generic / Local',
        preferredPackageSize: formData.preferredPackageSize.trim() || '1 Unit',
        unit,
        currentQuantity: Math.max(0, Number(formData.currentQuantity) || 0),
        averageDailyConsumption: Math.max(0, Number(formData.averageDailyConsumption) || 0),
        minStockThreshold: Math.max(0, Number(formData.minStockThreshold) || 0),
        targetStock: Math.max(1, Number(formData.targetStock) || 1),
        allowSubstitutions: Boolean(formData.allowSubstitutions),
        requireApprovalForBrandChange: Boolean(formData.requireApprovalForBrandChange),
        quantityStep,
        allowFractions: formData.allowFractions ?? !countable,
      });
      if (result === null) {
        setSaveError('Could not save this pantry item. Please try again.');
        return;
      }
      onClose();
    } catch (error: any) {
      setSaveError(error?.message || 'Could not save this pantry item. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const productFieldClass = `w-full px-3 py-2 border rounded-xl border-secondary-tint bg-surface text-ink min-h-[44px] ${productInformationLocked ? 'opacity-75' : ''}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
      <div className="bg-surface rounded-xl max-w-lg w-full p-6 shadow-card border border-secondary-tint max-h-[90vh] overflow-y-auto space-y-4" role="dialog" aria-modal="true" aria-labelledby="pantry-item-dialog-title">
        <h3 id="pantry-item-dialog-title" className="text-base font-bold text-ink">{title}</h3>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-3">
            <div>
              <label className="block text-ink font-semibold mb-1">Product Name</label>
              <input required readOnly={productInformationLocked} value={formData.name} onChange={event => setFormData({ ...formData, name: event.target.value })} className={productFieldClass} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-ink font-semibold mb-1">Category
                <select disabled={productInformationLocked} value={formData.category} onChange={event => setFormData({ ...formData, category: event.target.value as ProductCategory })} className={productFieldClass}>
                  {CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className="block text-ink font-semibold mb-1">Unit of Measurement
                <select disabled={productInformationLocked} value={formData.unit} onChange={event => handleUnitChange(event.target.value as UnitOfMeasurement)} className={productFieldClass}>
                  {UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-ink font-semibold mb-1">Preferred Brand
                <input readOnly={productInformationLocked} value={formData.preferredBrand} onChange={event => setFormData({ ...formData, preferredBrand: event.target.value })} className={productFieldClass} />
              </label>
              <label className="block text-ink font-semibold mb-1">Preferred Package Size
                <input readOnly={productInformationLocked} value={formData.preferredPackageSize} onChange={event => setFormData({ ...formData, preferredPackageSize: event.target.value })} className={productFieldClass} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-secondary-tint">
            <label className="block text-ink font-semibold mb-1">Current Stock
              <input type="number" step="any" min="0" required value={formData.currentQuantity} onChange={event => setFormData({ ...formData, currentQuantity: Number.parseFloat(event.target.value) || 0 })} className={productFieldClass} />
            </label>
            <label className="block text-ink font-semibold mb-1">Daily Burn Rate
              <input type="number" step="any" min="0" required value={formData.averageDailyConsumption} onChange={event => setFormData({ ...formData, averageDailyConsumption: Number.parseFloat(event.target.value) || 0 })} className={productFieldClass} />
            </label>
            <label className="block text-ink font-semibold mb-1">Min Safe Stock
              <input type="number" step="any" min="0" required value={formData.minStockThreshold} onChange={event => setFormData({ ...formData, minStockThreshold: Number.parseFloat(event.target.value) || 0 })} className={productFieldClass} />
            </label>
            <label className="block text-ink font-semibold mb-1">Target Restock
              <input type="number" step="any" min="1" required value={formData.targetStock} onChange={event => setFormData({ ...formData, targetStock: Number.parseFloat(event.target.value) || 1 })} className={productFieldClass} />
            </label>
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-secondary-tint hover:bg-paper transition cursor-pointer">
            <input type="checkbox" checked={formData.requireApprovalForBrandChange} onChange={event => setFormData({ ...formData, requireApprovalForBrandChange: event.target.checked, allowSubstitutions: true })} className="mt-0.5 rounded text-brand focus:ring-brand w-4 h-4 cursor-pointer" />
            <span><strong className="font-semibold text-ink text-xs block">Ask before swapping brands</strong><span className="text-[11px] text-ink-muted block leading-tight mt-0.5">ShopPilot will ask before substituting an alternate brand.</span></span>
          </label>

          {saveError && <p role="alert" className="rounded-lg border border-danger/25 bg-danger/10 p-2 text-danger">{saveError}</p>}
          <div className="pt-3 border-t border-secondary-tint flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSaving}>{isSaving ? 'Saving…' : saveLabel}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

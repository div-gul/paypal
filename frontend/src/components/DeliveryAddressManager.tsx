import React, { useState } from 'react';
import { AddressLabel, api, DeliveryAddress, DeliveryAddressInput } from '../api/client';
import { useDeliveryAddresses } from '../context/DeliveryAddressContext';
import { AlertCircle, Check, Crosshair, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Badge, Button, Card } from './ui';

const EMPTY_ADDRESS: DeliveryAddressInput = {
  fullName: '', mobileNumber: '', houseBuilding: '', streetLocality: '', landmark: '',
  city: '', state: '', pinCode: '', label: 'Home', isDefault: false,
};

interface FormDialogProps {
  initialAddress?: DeliveryAddress | null;
  onClose: () => void;
  onSaved?: (address: DeliveryAddress) => void;
  selectOnSave?: boolean;
}

export const DeliveryAddressFormDialog: React.FC<FormDialogProps> = ({ initialAddress, onClose, onSaved, selectOnSave = false }) => {
  const { save, select, addresses } = useDeliveryAddresses();
  const [form, setForm] = useState<DeliveryAddressInput>(() => initialAddress ? {
    fullName: initialAddress.fullName, mobileNumber: initialAddress.mobileNumber,
    houseBuilding: initialAddress.houseBuilding, streetLocality: initialAddress.streetLocality,
    landmark: initialAddress.landmark, city: initialAddress.city, state: initialAddress.state,
    pinCode: initialAddress.pinCode, label: initialAddress.label, isDefault: initialAddress.isDefault,
  } : { ...EMPTY_ADDRESS, isDefault: selectOnSave || addresses.length === 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState('');
  const [geocodeAttribution, setGeocodeAttribution] = useState('');

  const locate = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('This browser does not support location. Enter the address manually.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async position => {
      try {
        const result = await api.reverseGeocode(position.coords.latitude, position.coords.longitude);
        setForm(previous => ({ ...previous, ...result.address }));
        setGeocodeAttribution(`${result.provider} · ${result.attribution}`);
      } catch (err: any) {
        setError(err?.message || 'Could not look up an address. You can continue by entering it manually.');
      } finally { setIsLocating(false); }
    }, positionError => {
      const message = positionError.code === positionError.PERMISSION_DENIED
        ? 'Location permission was denied. You can enter the address manually.'
        : positionError.code === positionError.POSITION_UNAVAILABLE
          ? 'Your location is unavailable. You can enter the address manually.'
          : 'Location request timed out. You can enter the address manually.';
      setError(message);
      setIsLocating(false);
    }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 });
  };

  const update = (key: keyof DeliveryAddressInput, value: string | boolean) => setForm(previous => ({ ...previous, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      const address = await save(form, initialAddress?.id);
      if (selectOnSave || form.isDefault || !addresses.length) await select(address.id);
      onSaved?.(address);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not save the address. Please try again.');
    } finally { setIsSaving(false); }
  };

  const fieldClass = 'mt-1 w-full rounded-xl border border-secondary-tint bg-surface px-3 py-2.5 text-sm text-ink min-h-[44px]';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="presentation">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-secondary-tint bg-surface p-5 shadow-card" role="dialog" aria-modal="true" aria-labelledby="delivery-address-title">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h3 id="delivery-address-title" className="text-lg font-bold text-ink">{initialAddress ? 'Edit delivery address' : 'Add delivery address'}</h3><p className="mt-1 text-xs text-ink-muted">Enter an Indian address. Address details are saved to your account.</p></div>
          <Button variant="outline" size="sm" type="button" onClick={onClose}>Close</Button>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={locate} disabled={isLocating} isLoading={isLocating} icon={<Crosshair className="h-4 w-4" />}>Use my current location</Button>
        {geocodeAttribution && <p className="mt-2 text-[10px] text-ink-muted">Approximate lookup by {geocodeAttribution}. Review and correct every field before saving.</p>}
        {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/10 p-3 text-xs text-danger"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-ink">Full name<input required maxLength={120} autoComplete="name" value={form.fullName} onChange={event => update('fullName', event.target.value)} className={fieldClass} /></label>
            <label className="text-xs font-semibold text-ink">Mobile number<input required type="tel" inputMode="tel" autoComplete="tel" pattern="(?:\\+91[ -]?)?[6-9][0-9]{9}" title="Enter a valid Indian mobile number" value={form.mobileNumber} onChange={event => update('mobileNumber', event.target.value)} className={fieldClass} /></label>
            <label className="text-xs font-semibold text-ink">House / Flat / Building<input required maxLength={160} autoComplete="address-line1" value={form.houseBuilding} onChange={event => update('houseBuilding', event.target.value)} className={fieldClass} /></label>
            <label className="text-xs font-semibold text-ink">Street / Area / Locality<input required maxLength={180} autoComplete="address-line2" value={form.streetLocality} onChange={event => update('streetLocality', event.target.value)} className={fieldClass} /></label>
            <label className="text-xs font-semibold text-ink">Landmark <span className="font-normal text-ink-muted">(optional)</span><input maxLength={160} value={form.landmark} onChange={event => update('landmark', event.target.value)} className={fieldClass} /></label>
            <label className="text-xs font-semibold text-ink">City<input required maxLength={100} autoComplete="address-level2" value={form.city} onChange={event => update('city', event.target.value)} className={fieldClass} /></label>
            <label className="text-xs font-semibold text-ink">State<input required maxLength={100} autoComplete="address-level1" value={form.state} onChange={event => update('state', event.target.value)} className={fieldClass} /></label>
            <label className="text-xs font-semibold text-ink">PIN code<input required inputMode="numeric" autoComplete="postal-code" pattern="[1-9][0-9]{5}" maxLength={6} title="Enter a valid six-digit Indian PIN code" value={form.pinCode} onChange={event => update('pinCode', event.target.value)} className={fieldClass} /></label>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <label className="flex-1 text-xs font-semibold text-ink">Address label<select value={form.label} onChange={event => update('label', event.target.value as AddressLabel)} className={fieldClass}><option>Home</option><option>Work</option><option>Other</option></select></label>
            <label className="flex items-center gap-2 pb-3 text-xs font-medium text-ink"><input type="checkbox" checked={!!form.isDefault || selectOnSave} disabled={selectOnSave || !!initialAddress?.isDefault} onChange={event => update('isDefault', event.target.checked)} className="h-4 w-4 accent-brand" />Set as default</label>
          </div>
          <div className="flex justify-end gap-2 border-t border-secondary-tint pt-3"><Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button type="submit" size="sm" isLoading={isSaving}>{selectOnSave ? 'Save and use address' : 'Save address'}</Button></div>
        </form>
      </div>
    </div>
  );
};

export const DeliveryAddressManager: React.FC = () => {
  const { addresses, isLoading, error, reload, remove, select, clearError } = useDeliveryAddresses();
  const [editing, setEditing] = useState<DeliveryAddress | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [actionError, setActionError] = useState('');

  const onDelete = async (address: DeliveryAddress) => {
    if (!window.confirm(`Delete the ${address.label.toLowerCase()} address for ${address.city}?`)) return;
    try { await remove(address.id); setActionError(''); }
    catch (err: any) { setActionError(err?.message || 'Could not delete the address.'); }
  };

  return <section className="space-y-4" aria-labelledby="delivery-addresses-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="delivery-addresses-heading" className="text-xl font-bold text-ink flex items-center gap-2"><MapPin className="h-5 w-5 text-brand" />Delivery addresses</h2><p className="mt-1 text-xs text-ink-muted">Choose a saved address for simulated orders. Any valid Indian PIN code is accepted.</p></div><Button size="sm" onClick={() => { setEditing(null); setIsAdding(true); }} icon={<Plus className="h-4 w-4" />}>Add address</Button></div>
    {(error || actionError) && <p role="alert" className="flex items-center justify-between rounded-xl border border-danger/25 bg-danger/10 p-3 text-xs text-danger">{error || actionError}<button onClick={() => { clearError(); setActionError(''); void reload(); }} className="underline">Dismiss</button></p>}
    {isLoading ? <p className="py-6 text-center text-sm text-ink-muted">Loading saved addresses…</p> : addresses.length === 0 ? <Card className="p-6 text-center text-sm text-ink-muted">No address saved yet. You can keep exploring and add one before checkout.</Card> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{addresses.map(address => <AddressCard key={address.id} address={address} onEdit={() => { setEditing(address); setIsAdding(true); }} onDelete={() => void onDelete(address)} onSelect={() => void select(address.id).catch((err: any) => setActionError(err.message))} />)}</div>}
    {isAdding && <DeliveryAddressFormDialog initialAddress={editing} onClose={() => setIsAdding(false)} />}
  </section>;
};

const AddressCard: React.FC<{ address: DeliveryAddress; onEdit: () => void; onDelete: () => void; onSelect: () => void }> = ({ address, onEdit, onDelete, onSelect }) => <Card className="space-y-3">
  <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge variant={address.isDefault ? 'success' : 'neutral'} icon={address.isDefault ? <Star className="h-3 w-3" /> : undefined}>{address.isDefault ? 'Default' : address.label}</Badge>{address.isDefault && <span className="text-xs text-ink-muted">{address.label}</span>}</div><div className="flex gap-1"><button title="Edit address" onClick={onEdit} className="p-2 rounded-lg hover:bg-paper text-ink-muted"><Pencil className="h-4 w-4" /></button><button title="Delete address" onClick={onDelete} className="p-2 rounded-lg hover:bg-danger/10 text-ink-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button></div></div>
  <div className="text-sm text-ink"><p className="font-semibold">{address.fullName} · {address.mobileNumber}</p><p className="mt-1 text-xs leading-relaxed text-ink-muted">{[address.houseBuilding, address.streetLocality, address.landmark, `${address.city}, ${address.state} ${address.pinCode}`, address.country].filter(Boolean).join(', ')}</p></div>
  {!address.isDefault && <Button size="sm" variant="outline" onClick={onSelect} icon={<Check className="h-4 w-4" />}>Use this address</Button>}
</Card>;

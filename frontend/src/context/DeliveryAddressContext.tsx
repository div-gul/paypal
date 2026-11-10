import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, DeliveryAddress, DeliveryAddressInput } from '../api/client';

interface DeliveryAddressContextValue {
  addresses: DeliveryAddress[];
  selectedAddress: DeliveryAddress | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  save: (input: DeliveryAddressInput, id?: string) => Promise<DeliveryAddress>;
  remove: (id: string) => Promise<void>;
  select: (id: string) => Promise<void>;
  clearError: () => void;
}

const DeliveryAddressContext = createContext<DeliveryAddressContextValue | null>(null);

export const DeliveryAddressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.getDeliveryAddresses();
      setAddresses(result.addresses);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Could not load delivery addresses.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const save = useCallback(async (input: DeliveryAddressInput, id?: string) => {
    const result = id ? await api.updateDeliveryAddress(id, input) : await api.createDeliveryAddress(input);
    await reload();
    return result.address;
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await api.deleteDeliveryAddress(id);
    await reload();
  }, [reload]);

  const select = useCallback(async (id: string) => {
    const result = await api.setDefaultDeliveryAddress(id);
    setAddresses(previous => [result.address, ...previous.filter(address => address.id !== id).map(address => ({ ...address, isDefault: false }))]);
  }, []);

  const selectedAddress = addresses.find(address => address.isDefault) || null;
  const clearError = useCallback(() => setError(null), []);

  return <DeliveryAddressContext.Provider value={{ addresses, selectedAddress, isLoading, error, reload, save, remove, select, clearError }}>{children}</DeliveryAddressContext.Provider>;
};

export function useDeliveryAddresses(): DeliveryAddressContextValue {
  const context = useContext(DeliveryAddressContext);
  if (!context) throw new Error('useDeliveryAddresses must be used inside DeliveryAddressProvider');
  return context;
}

export function formatDeliveryAddress(address: Pick<DeliveryAddress, 'houseBuilding' | 'streetLocality' | 'landmark' | 'city' | 'state' | 'pinCode'>): string {
  return [address.houseBuilding, address.streetLocality, address.landmark, `${address.city}, ${address.state} ${address.pinCode}`]
    .filter(Boolean).join(', ');
}

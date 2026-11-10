import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDatabase } from '../db/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { DeliveryAddressInput, DeliveryAddressRepository } from '../repositories/DeliveryAddressRepository.js';

export const addressesRouter = Router();
const addressWriteLimit = rateLimit({ windowMs: 60_000, max: 30, key: req => `user:${req.user!.id}` }, 'address-write');
const reverseGeocodeLimit = rateLimit({ windowMs: 60_000, max: 5, key: req => `user:${req.user!.id}` }, 'reverse-geocode');
const nominatimServiceLimit = rateLimit({ windowMs: 1_000, max: 1, key: () => 'application' }, 'nominatim-service');

const AddressSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  mobileNumber: z.string().trim().transform(value => value.replace(/\D/g, '')).refine(value => /^(?:91)?[6-9]\d{9}$/.test(value), 'Enter a valid Indian mobile number.')
    .transform(value => value.length === 12 ? value.slice(2) : value),
  houseBuilding: z.string().trim().min(1).max(160),
  streetLocality: z.string().trim().min(2).max(180),
  landmark: z.string().trim().max(160).default(''),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pinCode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid six-digit Indian PIN code.'),
  label: z.enum(['Home', 'Work', 'Other']).default('Home'),
  isDefault: z.boolean().optional(),
}).strict();

const ReverseGeocodeSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
}).strict();

function parseInput(body: unknown): DeliveryAddressInput {
  return AddressSchema.parse(body) as DeliveryAddressInput;
}

addressesRouter.get('/addresses', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const addresses = new DeliveryAddressRepository(getDatabase()).list(_req.user!.id);
    res.json({ addresses });
  } catch (error) { next(error); }
});

addressesRouter.post('/addresses', addressWriteLimit, (req: Request, res: Response, next: NextFunction) => {
  try {
    const address = new DeliveryAddressRepository(getDatabase()).create(req.user!.id, `addr-${randomUUID()}`, parseInput(req.body));
    res.status(201).json({ address });
  } catch (error) { next(error); }
});

addressesRouter.put('/addresses/:id', addressWriteLimit, (req: Request, res: Response, next: NextFunction) => {
  try {
    const address = new DeliveryAddressRepository(getDatabase()).update(req.user!.id, req.params.id as string, parseInput(req.body));
    if (!address) throw new AppError('ADDRESS_NOT_FOUND', 'Delivery address not found.', 404);
    res.json({ address });
  } catch (error) { next(error); }
});

addressesRouter.delete('/addresses/:id', addressWriteLimit, (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = new DeliveryAddressRepository(getDatabase()).delete(req.user!.id, req.params.id as string);
    if (!deleted) throw new AppError('ADDRESS_NOT_FOUND', 'Delivery address not found.', 404);
    res.json({ success: true });
  } catch (error) { next(error); }
});

addressesRouter.post('/addresses/:id/default', addressWriteLimit, (req: Request, res: Response, next: NextFunction) => {
  try {
    const address = new DeliveryAddressRepository(getDatabase()).setDefault(req.user!.id, req.params.id as string);
    if (!address) throw new AppError('ADDRESS_NOT_FOUND', 'Delivery address not found.', 404);
    res.json({ address });
  } catch (error) { next(error); }
});

addressesRouter.post('/addresses/reverse-geocode', reverseGeocodeLimit, nominatimServiceLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { latitude, longitude } = ReverseGeocodeSchema.parse(req.body);
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('addressdetails', '1');
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ShopPilot-AI-Demo/1.0', 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new AppError('GEOCODING_FAILED', 'Location lookup is unavailable. You can enter the address manually.', 502);
    const data = await response.json() as { address?: Record<string, string> };
    const address = data.address || {};
    res.json({
      address: {
        houseBuilding: address.house_number || '',
        streetLocality: address.road || address.neighbourhood || address.suburb || address.residential || '',
        landmark: '',
        city: address.city || address.town || address.village || address.county || '',
        state: address.state || '',
        pinCode: address.postcode || '',
      },
      provider: 'OpenStreetMap Nominatim',
      attribution: '© OpenStreetMap contributors',
    });
  } catch (error: any) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      next(new AppError('GEOCODING_TIMEOUT', 'Location lookup timed out. You can enter the address manually.', 504));
      return;
    }
    next(error);
  }
});

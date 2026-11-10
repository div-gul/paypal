import Database from 'better-sqlite3';

export type AddressLabel = 'Home' | 'Work' | 'Other';

export interface DeliveryAddress {
  id: string;
  userId: string;
  fullName: string;
  mobileNumber: string;
  houseBuilding: string;
  streetLocality: string;
  landmark: string;
  city: string;
  state: string;
  pinCode: string;
  country: 'India';
  label: AddressLabel;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DeliveryAddressInput = Omit<DeliveryAddress, 'id' | 'userId' | 'country' | 'isDefault' | 'createdAt' | 'updatedAt'> & { isDefault?: boolean };

interface AddressRow {
  id: string; user_id: string; full_name: string; mobile_number: string; house_building: string;
  street_locality: string; landmark: string; city: string; state: string; pin_code: string;
  country: 'India'; label: AddressLabel; is_default: number; created_at: string; updated_at: string;
}

function mapRow(row: AddressRow): DeliveryAddress {
  return {
    id: row.id, userId: row.user_id, fullName: row.full_name, mobileNumber: row.mobile_number,
    houseBuilding: row.house_building, streetLocality: row.street_locality, landmark: row.landmark,
    city: row.city, state: row.state, pinCode: row.pin_code, country: row.country,
    label: row.label, isDefault: Boolean(row.is_default), createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export class DeliveryAddressRepository {
  constructor(private readonly db: Database.Database) {}

  list(userId: string): DeliveryAddress[] {
    return (this.db.prepare('SELECT * FROM delivery_addresses WHERE user_id = ? ORDER BY is_default DESC, updated_at DESC').all(userId) as AddressRow[]).map(mapRow);
  }

  get(userId: string, id: string): DeliveryAddress | null {
    const row = this.db.prepare('SELECT * FROM delivery_addresses WHERE user_id = ? AND id = ?').get(userId, id) as AddressRow | undefined;
    return row ? mapRow(row) : null;
  }

  create(userId: string, id: string, input: DeliveryAddressInput): DeliveryAddress {
    const write = this.db.transaction(() => {
      const isDefault = input.isDefault === true || this.list(userId).length === 0;
      if (isDefault) this.db.prepare('UPDATE delivery_addresses SET is_default = 0 WHERE user_id = ?').run(userId);
      const now = new Date().toISOString();
      const row = this.db.prepare(`
        INSERT INTO delivery_addresses (
          id, user_id, full_name, mobile_number, house_building, street_locality,
          landmark, city, state, pin_code, country, label, is_default, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'India', ?, ?, ?, ?) RETURNING *
      `).get(id, userId, input.fullName, input.mobileNumber, input.houseBuilding, input.streetLocality,
        input.landmark, input.city, input.state, input.pinCode, input.label, Number(isDefault), now, now) as AddressRow;
      return mapRow(row);
    });
    return write();
  }

  update(userId: string, id: string, input: DeliveryAddressInput): DeliveryAddress | null {
    const write = this.db.transaction(() => {
      const existing = this.get(userId, id);
      if (!existing) return null;
      const isDefault = input.isDefault === true || existing.isDefault;
      if (isDefault) this.db.prepare('UPDATE delivery_addresses SET is_default = 0 WHERE user_id = ?').run(userId);
      const row = this.db.prepare(`
        UPDATE delivery_addresses SET full_name = ?, mobile_number = ?, house_building = ?,
          street_locality = ?, landmark = ?, city = ?, state = ?, pin_code = ?, label = ?,
          is_default = ?, updated_at = ? WHERE user_id = ? AND id = ? RETURNING *
      `).get(input.fullName, input.mobileNumber, input.houseBuilding, input.streetLocality,
        input.landmark, input.city, input.state, input.pinCode, input.label,
        Number(isDefault), new Date().toISOString(), userId, id) as AddressRow;
      return mapRow(row);
    });
    return write();
  }

  setDefault(userId: string, id: string): DeliveryAddress | null {
    const write = this.db.transaction(() => {
      const existing = this.get(userId, id);
      if (!existing) return null;
      this.db.prepare('UPDATE delivery_addresses SET is_default = 0 WHERE user_id = ?').run(userId);
      const row = this.db.prepare('UPDATE delivery_addresses SET is_default = 1, updated_at = ? WHERE user_id = ? AND id = ? RETURNING *')
        .get(new Date().toISOString(), userId, id) as AddressRow;
      return mapRow(row);
    });
    return write();
  }

  delete(userId: string, id: string): boolean {
    const write = this.db.transaction(() => {
      const existing = this.get(userId, id);
      if (!existing) return false;
      this.db.prepare('DELETE FROM delivery_addresses WHERE user_id = ? AND id = ?').run(userId, id);
      if (existing.isDefault) {
        const next = this.db.prepare('SELECT id FROM delivery_addresses WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1').get(userId) as { id: string } | undefined;
        if (next) this.db.prepare('UPDATE delivery_addresses SET is_default = 1, updated_at = ? WHERE user_id = ? AND id = ?').run(new Date().toISOString(), userId, next.id);
      }
      return true;
    });
    return write();
  }
}

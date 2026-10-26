import Database from 'better-sqlite3';
import { SimClockRepository } from '../repositories/SimClockRepository.js';
import { PantryRepository } from '../repositories/PantryRepository.js';
import { AuditLogRepository } from '../repositories/AuditLogRepository.js';
import { advancePantryState } from '@shared/services/consumptionEngine';
import { SimulationState, PantryItem } from '@shared/types';

export class ClockService {
  private clockRepo: SimClockRepository;
  private pantryRepo: PantryRepository;
  private auditRepo: AuditLogRepository;

  constructor(private db: Database.Database) {
    this.clockRepo = new SimClockRepository(db);
    this.pantryRepo = new PantryRepository(db);
    this.auditRepo = new AuditLogRepository(db);
  }

  getClock(userId: string): SimulationState {
    const clock = this.clockRepo.getByUserId(userId);
    if (!clock) {
      throw new Error(`Clock not initialized for user ${userId}`);
    }
    return clock;
  }

  advanceTime(userId: string, days: 1 | 3 | 7): {
    clock: SimulationState;
    pantry: PantryItem[];
    stockoutsCount: number;
    depletedItems: string[];
  } {
    const tx = this.db.transaction(() => {
      // 1. Advance the clock
      const updatedClock = this.clockRepo.advanceDays(userId, days);

      // 2. Load current pantry and apply consumption rates
      const currentPantry = this.pantryRepo.getAllByUserId(userId);
      const updatedPantry = advancePantryState(currentPantry, days);

      // Save updated pantry quantities
      this.pantryRepo.batchSave(userId, updatedPantry);

      // 3. Detect newly depleted items
      const depletedItems: string[] = [];
      for (const item of updatedPantry) {
        if (item.currentQuantity === 0) {
          const prev = currentPantry.find(p => p.id === item.id);
          if (prev && prev.currentQuantity > 0) {
            depletedItems.push(item.name);
          }
        }
      }

      // 4. Record audit entry
      this.auditRepo.create(userId, {
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        simulatedDate: updatedClock.simulatedDate,
        type: 'time_advanced',
        title: `Time Advanced +${days} Day${days > 1 ? 's' : ''}`,
        description: `Simulation moved forward by ${days} day(s). Household inventory depleted according to calibrated burn rates.${
          depletedItems.length > 0 ? ` Stockouts: ${depletedItems.join(', ')}.` : ''
        }`,
        statusBadge: `+${days}d (${updatedClock.daysElapsed}d total)`,
        badgeColor: depletedItems.length > 0 ? 'rose' : 'blue',
      });

      if (depletedItems.length > 0) {
        this.auditRepo.create(userId, {
          id: `audit-${Date.now()}-so-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          simulatedDate: updatedClock.simulatedDate,
          type: 'stockout_warning',
          title: `Critical Stockout Alert: ${depletedItems.join(', ')}`,
          description: `Items have depleted to 0. Immediate autonomous restocking or emergency intervention recommended.`,
          statusBadge: 'Empty Stock',
          badgeColor: 'red',
        });
      }

      return {
        clock: updatedClock,
        pantry: updatedPantry,
        stockoutsCount: updatedPantry.filter(p => p.currentQuantity === 0).length,
        depletedItems,
      };
    });

    return tx();
  }
}

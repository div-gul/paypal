import Database from 'better-sqlite3';
import { SimulationState } from '@shared/types';

interface SimClockRecord {
  user_id: string;
  simulated_date: string;
  days_elapsed: number;
  cycle_count: number;
  updated_at: string;
}

export class SimClockRepository {
  constructor(private db: Database.Database) {}

  getByUserId(userId: string): SimulationState | null {
    const stmt = this.db.prepare('SELECT * FROM sim_clock WHERE user_id = ?');
    const row = stmt.get(userId) as SimClockRecord | undefined;
    if (!row) return null;
    return {
      simulatedDate: row.simulated_date,
      daysElapsed: row.days_elapsed,
      cycleCount: row.cycle_count,
    };
  }

  upsert(userId: string, state: SimulationState): SimulationState {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO sim_clock (user_id, simulated_date, days_elapsed, cycle_count, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        simulated_date = excluded.simulated_date,
        days_elapsed = excluded.days_elapsed,
        cycle_count = excluded.cycle_count,
        updated_at = excluded.updated_at
      RETURNING *
    `);
    const row = stmt.get(userId, state.simulatedDate, state.daysElapsed, state.cycleCount, now) as SimClockRecord;
    return {
      simulatedDate: row.simulated_date,
      daysElapsed: row.days_elapsed,
      cycleCount: row.cycle_count,
    };
  }

  advanceDays(userId: string, daysToAdvance: number): SimulationState {
    const current = this.getByUserId(userId);
    if (!current) {
      throw new Error(`Clock state not found for user ${userId}`);
    }

    const currentDate = new Date(current.simulatedDate);
    currentDate.setDate(currentDate.getDate() + daysToAdvance);

    const newState: SimulationState = {
      simulatedDate: currentDate.toISOString(),
      daysElapsed: current.daysElapsed + daysToAdvance,
      cycleCount: current.cycleCount + Math.floor((current.daysElapsed + daysToAdvance) / 7),
    };

    return this.upsert(userId, newState);
  }
}

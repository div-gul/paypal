import Database from 'better-sqlite3';
import { PolicyRepository, PolicyEntity } from '../repositories/PolicyRepository.js';

export class PolicyService {
  private policyRepo: PolicyRepository;

  constructor(db: Database.Database) {
    this.policyRepo = new PolicyRepository(db);
  }

  getPolicy(userId: string): PolicyEntity {
    let policy = this.policyRepo.getByUserId(userId);
    if (!policy) {
      // Defaults keep the existing UI and planner usable without persisting
      // any restocking preferences until the user saves their own settings.
      const now = new Date().toISOString();
      policy = {
        id: 'default-policy',
        preferredShoppingDay: 2,
        shoppingFrequency: 'weekly',
        nextShoppingDate: now,
        emergencyRestockPreference: 'ask_approval',
        urgentThresholdDays: 3,
        perCycleBudgetPaise: 250000,
        perOrderCapPaise: 150000,
        requireApprovalBrandSubstitution: true,
        requireApprovalEmergencyRun: true,
        blockedCategories: [],
        createdAt: now,
        updatedAt: now,
      };
    }
    return policy;
  }

  updatePolicy(userId: string, data: Partial<PolicyEntity>): PolicyEntity {
    return this.policyRepo.upsert(userId, data);
  }
}

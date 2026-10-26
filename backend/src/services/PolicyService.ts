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
      // Upsert default
      policy = this.policyRepo.upsert(userId, {});
    }
    return policy;
  }

  updatePolicy(userId: string, data: Partial<PolicyEntity>): PolicyEntity {
    return this.policyRepo.upsert(userId, data);
  }
}

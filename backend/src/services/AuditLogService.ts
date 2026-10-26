import Database from 'better-sqlite3';
import { AuditLogRepository } from '../repositories/AuditLogRepository.js';
import { ActivityLogItem } from '@shared/types';

export class AuditLogService {
  private auditRepo: AuditLogRepository;

  constructor(db: Database.Database) {
    this.auditRepo = new AuditLogRepository(db);
  }

  getRecentLogs(userId: string, limit: number = 50): ActivityLogItem[] {
    return this.auditRepo.getRecent(userId, limit);
  }

  log(userId: string, entry: ActivityLogItem): ActivityLogItem {
    return this.auditRepo.create(userId, entry);
  }
}

import { AuditLog } from './audit-log.entity';

export const AUDIT_LOG_REPOSITORY = 'AUDIT_LOG_REPOSITORY';

export interface IAuditLogRepository {
  create(
    tenantId: string,
    eventType: string,
    payload: any,
    hashFn: (prevHash: string | null) => string,
    tx?: any, // Should be Prisma.TransactionClient but we use any to avoid direct coupling
  ): Promise<AuditLog>;

  findByTenantId(tenantId: string): Promise<AuditLog[]>;
}

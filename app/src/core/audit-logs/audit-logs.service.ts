import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  IAuditLogRepository,
  AUDIT_LOG_REPOSITORY,
} from './domain/audit-log.repository.interface';
import { AuditLog } from './domain/audit-log.entity';

@Injectable()
export class AuditLogsService {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly repository: IAuditLogRepository,
  ) {}

  private stableStringify(obj: unknown): string {
    if (typeof obj !== 'object' || obj === null) {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return (
        '[' + obj.map((item) => this.stableStringify(item)).join(',') + ']'
      );
    }
    const typedObj = obj as Record<string, unknown>;
    const keys = Object.keys(typedObj).sort();
    const parts = keys.map(
      (key) => JSON.stringify(key) + ':' + this.stableStringify(typedObj[key]),
    );
    return '{' + parts.join(',') + '}';
  }

  private calculateHash(prevHash: string | null, data: unknown): string {
    // Genesis hash convention: '0'.repeat(64) if prevHash is null
    const prev = prevHash || '0'.repeat(64);
    const dataString = this.stableStringify(data);
    const input = prev + dataString;
    return createHash('sha256').update(input).digest('hex');
  }

  async recordLog(
    tenantId: string,
    eventType: string,
    payload: Record<string, unknown>,
    tx?: unknown,
  ): Promise<AuditLog> {
    return this.repository.create(
      tenantId,
      eventType,
      payload,
      (prevHash) => {
        // Logic executed inside the repository's transaction/lock context
        const dataToHash = { eventType, payload };
        return this.calculateHash(prevHash, dataToHash);
      },
      tx,
    );
  }

  /**
   * Alias for recordLog to maintain backward compatibility with existing code.
   */
  async createLog(
    tenantId: string,
    eventType: string,
    payload: Record<string, unknown>,
    tx?: unknown,
  ): Promise<AuditLog> {
    return this.recordLog(tenantId, eventType, payload, tx);
  }

  async verifyChain(
    tenantId: string,
  ): Promise<{ status: 'ok' | 'broken'; brokenAt?: string }> {
    const logs = await this.repository.findByTenantId(tenantId);

    if (logs.length === 0) {
      return { status: 'ok' };
    }

    let expectedPrevHash: string | null = null;

    for (const log of logs) {
      // Check 1: Pointer integrity
      // For the very first log, prevHash in DB is null.
      if (expectedPrevHash === null) {
        if (log.prevHash !== null) {
          return { status: 'broken', brokenAt: log.id };
        }
      } else {
        if (log.prevHash !== expectedPrevHash) {
          return { status: 'broken', brokenAt: log.id };
        }
      }

      // Check 2: Content integrity (Hash recalculation)
      const dataToHash = { eventType: log.eventType, payload: log.payload };
      const prevForCalc: string = log.prevHash || '0'.repeat(64);

      const calculatedHash: string = createHash('sha256')
        .update(prevForCalc + this.stableStringify(dataToHash))
        .digest('hex');

      if (calculatedHash !== log.hash) {
        return { status: 'broken', brokenAt: log.id };
      }

      expectedPrevHash = log.hash;
    }

    return { status: 'ok' };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  private serialize(obj: any): string {
    if (!obj) return '';
    return JSON.stringify(obj, Object.keys(obj).sort());
  }

  // Transactional logging
  async logTransaction(tx: Prisma.TransactionClient, tenantId: string, eventType: string, payload: any) {
    const lastLog = await tx.auditLog.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
    });
    const prevHash = lastLog ? lastLog.hash : null;

    const payloadStr = this.serialize(payload);
    const hashInput = (prevHash || '') + payloadStr;
    const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

    await tx.auditLog.create({
        data: {
        tenantId,
        eventType,
        payload,
        prevHash,
        hash,
        },
    });
  }

  // Non-transactional logging (uses this.prisma)
  async createLog(tenantId: string, eventType: string, payload: any) {
    // We can just reuse logTransaction with this.prisma as tx
    // because PrismaService extends PrismaClient which is compatible with TransactionClient
    // (mostly, or we cast it).
    // Actually PrismaClient is not exactly TransactionClient, but close.
    // Let's implement separately or use this.prisma as any.
    return this.logTransaction(this.prisma as unknown as Prisma.TransactionClient, tenantId, eventType, payload);
  }

  async verifyChain(tenantId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    if (logs.length === 0) {
      return { status: 'ok', message: 'No logs found' };
    }

    for (let i = 0; i < logs.length; i++) {
      const current = logs[i];
      const prevHash = i === 0 ? null : logs[i - 1].hash;

      if (current.prevHash !== prevHash) {
         return {
           status: 'broken',
           atId: current.id,
           reason: `prevHash mismatch. Expected ${prevHash}, got ${current.prevHash}`
         };
      }

      const payloadStr = this.serialize(current.payload);
      const hashInput = (prevHash || '') + payloadStr;
      const calculatedHash = crypto.createHash('sha256').update(hashInput).digest('hex');

      if (calculatedHash !== current.hash) {
          return {
              status: 'broken',
              atId: current.id,
              reason: `Hash mismatch. Expected ${calculatedHash}, got ${current.hash}`
          };
      }
    }

    return { status: 'ok' };
  }
}

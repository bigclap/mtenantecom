import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async createLog(
    tenantId: string,
    eventType: string,
    payload: Record<string, any>,
  ) {
    // Basic implementation for now to support Returns
    // Full chain implementation should be done in Task 6

    // Simplistic approach: find last hash (optional for now or basic query)
    const lastLog = await this.prisma.auditLog.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const prevHash = lastLog ? lastLog.hash : '0'.repeat(64);
    const dataString = prevHash + JSON.stringify(payload);
    const hash = crypto.createHash('sha256').update(dataString).digest('hex');

    return this.prisma.auditLog.create({
      data: {
        tenantId,
        eventType,
        payload,
        prevHash,
        hash,
      },
    });
  }
}

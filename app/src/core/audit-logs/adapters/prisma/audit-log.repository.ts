import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { IAuditLogRepository } from '../../domain/audit-log.repository.interface';
import { AuditLog } from '../../domain/audit-log.entity';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuditLogPrismaRepository implements IAuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    eventType: string,
    payload: any,
    hashFn: (prevHash: string | null) => string,
    externalTx?: Prisma.TransactionClient,
  ): Promise<AuditLog> {
    const executeLogic = async (tx: Prisma.TransactionClient) => {
      // ARCH: Pessimistic Locking.
      // To ensure strict sequence even for the very first record, we lock the Tenant row.
      // This prevents race conditions where multiple processes try to create the first log simultaneously.
      await tx.$executeRaw`SELECT 1 FROM "tenants" WHERE "id" = ${tenantId}::uuid FOR UPDATE`;

      const lastLog = await tx.auditLog.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });

      const prevHash = lastLog ? lastLog.hash : null;
      const newHash = hashFn(prevHash);

      const created = await tx.auditLog.create({
        data: {
          tenantId,
          eventType,
          payload,
          prevHash,
          hash: newHash,
        },
      });

      return new AuditLog(
        created.id,
        created.tenantId,
        created.eventType,
        created.payload,
        created.hash,
        created.prevHash,
        created.createdAt,
      );
    };

    if (externalTx) {
      return executeLogic(externalTx);
    }

    return this.prisma.$transaction(executeLogic);
  }

  async findByTenantId(tenantId: string): Promise<AuditLog[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    return logs.map(
      (log) =>
        new AuditLog(
          log.id,
          log.tenantId,
          log.eventType,
          log.payload,
          log.hash,
          log.prevHash,
          log.createdAt,
        ),
    );
  }
}

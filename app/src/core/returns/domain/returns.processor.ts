import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ReturnStatus } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { AuditLogsService } from '../../audit-logs/domain/audit-logs.service';

@Processor('returns.process')
export class ReturnsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReturnsProcessor.name);

  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService
  ) {
    super();
  }

  async process(job: Job<{ tenantId: string; returnId: string }>): Promise<any> {
    const { tenantId, returnId } = job.data;
    this.logger.log(`Processing return ${returnId} for tenant ${tenantId}`);

    try {
      await this.prisma.$transaction(async (tx) => {
        const ret = await tx.return.findUnique({
          where: { id: returnId },
          include: { items: { include: { orderItem: true } } },
        });

        if (!ret) throw new Error('Return not found');
        if (ret.status !== ReturnStatus.PENDING) return;

        await tx.return.update({
          where: { id: returnId },
          data: { status: ReturnStatus.APPROVED },
        });

        for (const item of ret.items) {
           await tx.stockLevel.update({
             where: { tenantId_sku: { tenantId, sku: item.orderItem.sku } },
             data: {
               available: { increment: item.qty },
             },
           });
        }

        await this.auditLogsService.logTransaction(
            tx,
            tenantId,
            'RETURN_APPROVED',
            { returnId: ret.id, status: 'APPROVED' }
        );
      });
    } catch (e) {
      this.logger.error(`Failed to process return ${returnId}`, e.stack);
      throw e;
    }
  }
}

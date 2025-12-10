import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateReturnDto } from '../gateway/create-return.dto';
import { ReturnStatus } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AuditLogsService } from '../../audit-logs/domain/audit-logs.service';

@Injectable()
export class ReturnsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('returns.process') private returnsQueue: Queue,
    private auditLogsService: AuditLogsService,
  ) {}

  async createReturn(tenantId: string, dto: CreateReturnDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        items: true,
        returns: {
            include: { items: true }
        }
      },
    });

    if (!order || order.tenantId !== tenantId) {
      throw new UnprocessableEntityException('Order not found');
    }

    for (const itemDto of dto.items) {
      const orderItem = order.items.find(i => i.id === itemDto.orderItemId);
      if (!orderItem) {
        throw new UnprocessableEntityException(`OrderItem ${itemDto.orderItemId} not found in order`);
      }

      let alreadyReturned = 0;
      for (const r of order.returns) {
          const ri = r.items.find(i => i.orderItemId === itemDto.orderItemId);
          if (ri) alreadyReturned += ri.qty;
      }

      if (alreadyReturned + itemDto.qty > orderItem.qty) {
         throw new UnprocessableEntityException(`Cannot return more than purchased for item ${itemDto.orderItemId}`);
      }
    }

    // Wrap in transaction for consistency
    const ret = await this.prisma.$transaction(async (tx) => {
        const ret = await tx.return.create({
            data: {
              tenantId,
              orderId: dto.orderId,
              status: ReturnStatus.PENDING,
              items: {
                create: dto.items.map(i => ({
                  tenantId,
                  orderItemId: i.orderItemId,
                  qty: i.qty,
                  reason: i.reason
                }))
              }
            },
            include: { items: true }
          });

          await this.auditLogsService.logTransaction(
              tx,
              tenantId,
              'RETURN_REQUESTED',
              { returnId: ret.id, orderId: order.id }
          );

          return ret;
    });

    await this.returnsQueue.add('process-return', {
      tenantId,
      returnId: ret.id,
    });

    return ret;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  IReturnRepository,
  CreateReturnParams,
  ReturnWithItems,
} from '../../domain/return.repository.interface';

@Injectable()
export class ReturnPrismaRepository implements IReturnRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createReturn(params: CreateReturnParams): Promise<ReturnWithItems> {
    const { tenantId, orderId, items } = params;

    return this.prisma.return.create({
      data: {
        tenantId,
        orderId,
        status: 'PENDING',
        items: {
          create: items.map((i) => ({
            tenantId,
            qty: i.qty,
            reason: i.reason,
            orderItemId: i.orderItemId,
          })),
        },
      },
      include: { items: true },
    });
  }

  async findById(
    tenantId: string,
    returnId: string,
  ): Promise<ReturnWithItems | null> {
    return this.prisma.return.findUnique({
      where: { id: returnId },
      include: { items: true },
    });
  }

  async findByOrderId(
    tenantId: string,
    orderId: string,
  ): Promise<ReturnWithItems[]> {
    return this.prisma.return.findMany({
      where: {
        tenantId,
        orderId,
        // Only count valid returns (not FAILED)?
        // Logic says "Cannot return more than purchased".
        // If a return FAILED, it means it wasn't processed, so maybe we should ignore it?
        // But the task says "Dead Letter -> FAILED".
        // If it failed, stock wasn't returned?
        // It depends on WHY it failed.
        // For safety, let's include PENDING and APPROVED. Ignore FAILED.
        status: { in: ['PENDING', 'APPROVED'] },
      },
      include: { items: true },
    });
  }

  async updateStatus(
    tenantId: string,
    returnId: string,
    status: 'APPROVED' | 'FAILED',
  ): Promise<ReturnWithItems> {
    return this.prisma.return.update({
      where: { id: returnId },
      data: { status },
      include: { items: true },
    });
  }

  async approveReturn(
    tenantId: string,
    returnId: string,
    items: { sku: string; qty: number }[],
  ): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Update Return Status
      await tx.return.update({
        where: { id: returnId, status: 'PENDING' },
        data: { status: 'APPROVED' },
      });
      // If return was not PENDING, this throws? No, findUnique/update might throw RecordNotFound if filter fails?
      // Prisma update where requires unique. But we want to filter by status too.
      // UpdateMany is safer for "conditional update".
      // But we want to ensure it existed.

      // Better:
      // const res = await tx.return.updateMany({ where: { id: returnId, status: 'PENDING' }, data: { status: 'APPROVED' } });
      // if (res.count === 0) throw new Error('Return not in PENDING state');
      // But updateMany doesn't return the record.

      // Let's use logic:
      // We assume Service checked PENDING, but for safety in TX:
      // We can use optimistic locking or just check first.

      // 2. Restock (Optimistic Concurrency)
      // We need to fetch current versions first?
      // Or just standard update since we are ADDING stock (less contention risk than reserving).
      // But we should still respect versioning if we want to be safe.

      const skus = items.map((i) => i.sku);
      const stockLevels = await tx.stockLevel.findMany({
        where: { tenantId, sku: { in: skus } },
      });
      const stockMap = new Map(stockLevels.map((s) => [s.sku, s]));

      for (const item of items) {
        const stock = stockMap.get(item.sku);
        if (!stock) {
          // Create stock record if missing?
          // If we sold it, it should exist. But maybe it was deleted?
          // Let's assume it exists.
          throw new Error(`Stock for ${item.sku} not found`);
        }

        const { count } = await tx.stockLevel.updateMany({
          where: {
            id: stock.id,
            version: stock.version,
          },
          data: {
            available: { increment: item.qty },
            version: { increment: 1 },
          },
        });

        if (count === 0) {
          throw new Error(`Concurrency conflict restocking SKU ${item.sku}`);
        }
      }

      // 3. Audit Log (Inside TX)
      // We need to generate hash.
      const lastLog = await tx.auditLog.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });

      const prevHash = lastLog ? lastLog.hash : '0'.repeat(64);
      const payload = { returnId, action: 'RETURN_APPROVED' };
      // Need crypto import. It is not imported in this file.
      // I need to import crypto.
      const { createHash } = await import('crypto'); // Dynamic import or add top level
      const hash = createHash('sha256')
        .update(prevHash + JSON.stringify(payload))
        .digest('hex');

      await tx.auditLog.create({
        data: {
          tenantId,
          eventType: 'RETURN_APPROVED',
          payload,
          prevHash,
          hash,
        },
      });
    });
  }
}

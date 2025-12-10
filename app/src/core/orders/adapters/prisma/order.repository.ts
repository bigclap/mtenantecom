import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  IOrderRepository,
  CreateOrderTxParams,
} from '../../domain/order.repository.interface';
import { Order, OrderStatus } from '../../domain/order.entity';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrderPrismaRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByExternalId(
    tenantId: string,
    externalId: string,
  ): Promise<Order | null> {
    const order = await this.prisma.order.findUnique({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId,
        },
      },
      include: { items: true },
    });

    if (!order) return null;

    // Map Prisma Order to Domain Order (if needed, or just cast if compatible)
    return {
      ...order,
      customer: order.customer as Record<string, any>,
      status: order.status as OrderStatus,
      items: order.items.map((i) => ({
        id: i.id,
        sku: i.sku,
        qty: i.qty,
      })),
    };
  }

  async findById(tenantId: string, id: string): Promise<Order | null> {
    const order = await this.prisma.order.findUnique({
      where: {
        id,
      },
      include: { items: true },
    });

    if (!order || order.tenantId !== tenantId) return null;

    return {
      ...order,
      customer: order.customer as Record<string, any>,
      status: order.status as OrderStatus,
      items: order.items.map((i) => ({
        id: i.id,
        sku: i.sku,
        qty: i.qty,
      })),
    };
  }

  async create(params: CreateOrderTxParams): Promise<Order> {
    const { tenantId, items } = params;

    return this.prisma.$transaction(async (tx) => {
      // 1. Stock Check & Reservation (Logic moved from StockService)
      // We optimize by fetching all needed stock levels
      const skus = items.map((i) => i.sku);
      const stockLevels = await tx.stockLevel.findMany({
        where: { tenantId, sku: { in: skus } },
      });
      const stockMap = new Map(stockLevels.map((s) => [s.sku, s]));

      const stockErrors = [];

      // Validation Phase
      for (const item of items) {
        const stock = stockMap.get(item.sku);
        const available = stock ? stock.available : 0;
        if (available < item.qty) {
          stockErrors.push({
            sku: item.sku,
            requested: item.qty,
            available,
          });
        }
      }

      if (stockErrors.length > 0) {
        throw new UnprocessableEntityException({
          error: 'INSUFFICIENT_STOCK',
          details: stockErrors,
        });
      }

      // Update Phase (Optimistic Concurrency)
      for (const item of items) {
        const stock = stockMap.get(item.sku);
        // If validation passed, stock must exist (or we treated missing as 0, which failed validation if qty > 0)
        // If qty was 0, validation passed.
        if (item.qty > 0) {
          // We can use the version we read earlier.
          // If version changed, updateMany returns count 0 -> throw -> transaction rollback
          const { count } = await tx.stockLevel.updateMany({
            where: {
              id: stock!.id,
              version: stock!.version,
              available: { gte: item.qty },
            },
            data: {
              available: { decrement: item.qty },
              reserved: { increment: item.qty },
              version: { increment: 1 },
            },
          });

          if (count === 0) {
            throw new Error(`Concurrency conflict for SKU ${item.sku}`);
          }
        }
      }

      // 2. Create Order
      const order = await tx.order.create({
        data: {
          tenantId: params.tenantId,
          externalId: params.externalId,
          customer: params.customer as Prisma.InputJsonValue,
          status: 'PENDING',
          items: {
            create: params.items.map((i) => ({
              tenantId: params.tenantId,
              sku: i.sku,
              qty: i.qty,
            })),
          },
        },
        include: { items: true },
      });

      // 3. Audit Log (Hash Chain)
      // To ensure strict sequence, we might want to lock.
      // Postgres: SELECT ... FOR UPDATE.
      // Prisma Raw for locking the last audit log or a specialized table.
      // For now, we follow the previous logic but inside this transaction.
      // Since it's serializable transaction (or default isolation), it might be enough if isolation level is high.

      const lastLog = await tx.auditLog.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });

      const prevHash = lastLog ? lastLog.hash : '0'.repeat(64);
      const payload = { orderId: order.id, action: 'ORDER_CREATED' };
      const hash = crypto
        .createHash('sha256')
        .update(prevHash + JSON.stringify(payload))
        .digest('hex');

      await tx.auditLog.create({
        data: {
          tenantId,
          eventType: 'ORDER_CREATED',
          payload: payload as Prisma.InputJsonValue,
          prevHash,
          hash,
        },
      });

      return {
        ...order,
        customer: order.customer as Record<string, any>,
        status: order.status as OrderStatus,
        items: order.items.map((i) => ({
          id: i.id,
          sku: i.sku,
          qty: i.qty,
        })),
      };
    });
  }
}

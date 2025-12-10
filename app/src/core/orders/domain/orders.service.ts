import { Injectable, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateOrderDto } from '../gateway/create-order.dto';
import { OrderStatus } from '@prisma/client';
import { AuditLogsService } from '../../audit-logs/domain/audit-logs.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

  async createOrder(tenantId: string, dto: CreateOrderDto) {
    const existingOrder = await this.prisma.order.findUnique({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId: dto.externalId,
        },
      },
      include: { items: true },
    });

    if (existingOrder) {
      if (existingOrder.items.length === dto.items.length) {
         return existingOrder;
      }
      throw new ConflictException('Order with this externalId already exists but with different content');
    }

    return this.prisma.$transaction(async (tx) => {
      const skuSet = new Set(dto.items.map((i) => i.sku));
      const stockLevels = await tx.stockLevel.findMany({
        where: {
          tenantId,
          sku: { in: Array.from(skuSet) },
        },
      });

      const stockMap = new Map(stockLevels.map((sl) => [sl.sku, sl]));
      const insufficientStockErrors = [];

      for (const item of dto.items) {
        const stock = stockMap.get(item.sku);
        const available = stock ? stock.available : 0;

        if (available < item.qty) {
          insufficientStockErrors.push({
            sku: item.sku,
            requested: item.qty,
            available,
          });
        }
      }

      if (insufficientStockErrors.length > 0) {
        throw new UnprocessableEntityException({
          error: 'INSUFFICIENT_STOCK',
          details: insufficientStockErrors,
        });
      }

      for (const item of dto.items) {
        await tx.stockLevel.update({
          where: { tenantId_sku: { tenantId, sku: item.sku } },
          data: {
            available: { decrement: item.qty },
            reserved: { increment: item.qty },
          },
        });
      }

      const order = await tx.order.create({
        data: {
          tenantId,
          externalId: dto.externalId,
          customer: dto.customer as any,
          status: OrderStatus.PENDING,
          items: {
            create: dto.items.map((i) => ({
              tenantId,
              sku: i.sku,
              qty: i.qty,
            })),
          },
        },
        include: { items: true },
      });

      await this.auditLogsService.logTransaction(
        tx,
        tenantId,
        'ORDER_CREATED',
        { orderId: order.id, externalId: order.externalId }
      );

      return order;
    });
  }

  async shipOrder(tenantId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order || order.tenantId !== tenantId) {
        throw new UnprocessableEntityException('Order not found');
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new ConflictException('Order is not in PENDING status');
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.SHIPPED },
      });

      const items = await tx.orderItem.findMany({
        where: { orderId: orderId },
      });

      for (const item of items) {
        await tx.stockLevel.update({
          where: { tenantId_sku: { tenantId, sku: item.sku } },
          data: {
            reserved: { decrement: item.qty },
          },
        });
      }

      await this.auditLogsService.logTransaction(
        tx,
        tenantId,
        'ORDER_SHIPPED',
        { orderId: order.id, status: 'SHIPPED' }
      );

      return updatedOrder;
    });
  }
}

import {
  Injectable,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { StockService } from '../../stock/domain/stock.service';
import { CreateOrderDto } from '../gateway/dto/create-order.dto';
import { Prisma, Order, OrderItem } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async createOrder(tenantId: string, dto: CreateOrderDto): Promise<Order> {
    // 1. Idempotency Check (Outside transaction for read performance, or inside for strictness? Inside is better for race conditions but "findUnique" is fast)
    // We check existence first.
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
      if (this.isOrderContentEqual(existingOrder, dto)) {
        return existingOrder;
      } else {
        throw new ConflictException(
          'Order with same externalId but different content exists',
        );
      }
    }

    // 2. Transaction
    return this.prisma.$transaction(async (tx) => {
      // Re-check inside transaction? Optional if Unique Constraint exists (it does).
      // If race condition happens here, insert will fail with Unique Constraint violation.
      // We can catch that and return existing or conflict, but simpler to rely on initial check + DB error handling.

      // 3. Stock Check
      const stockErrors = await this.stockService.checkStockAvailability(
        tenantId,
        dto.items,
        tx,
      );
      if (stockErrors.length > 0) {
        throw new UnprocessableEntityException({
          error: 'INSUFFICIENT_STOCK',
          details: stockErrors,
        });
      }

      // 4. Create Order
      const order = await tx.order.create({
        data: {
          tenantId,
          externalId: dto.externalId,
          customer: dto.customer as unknown as Prisma.InputJsonValue, // Explicit cast to Prisma Json type
          status: 'PENDING',
          items: {
            create: dto.items.map((i) => ({
              tenantId,
              sku: i.sku,
              qty: i.qty,
            })),
          },
        },
      });

      // 5. Update Stock
      await this.stockService.decreaseStock(tenantId, dto.items, tx);

      // 6. Audit Log
      // Simple implementation of Hash Chain
      // In real app: locking required (SELECT ... FOR UPDATE).
      // Here we just take last one.
      const lastLog = await tx.auditLog.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });

      const prevHash = lastLog ? lastLog.hash : '0'.repeat(64);
      const payload = { orderId: order.id, action: 'ORDER_CREATED' };
      const hash = this.calculateHash(prevHash, JSON.stringify(payload));

      await tx.auditLog.create({
        data: {
          tenantId,
          eventType: 'ORDER_CREATED',
          payload,
          prevHash,
          hash,
        },
      });

      return order;
    });
  }

  private isOrderContentEqual(
    existing: Order & { items: OrderItem[] },
    dto: CreateOrderDto,
  ): boolean {
    // Compare Customer
    // Cast existing.customer to any or specific type
    const existingCustomer = existing.customer as Record<string, any>;
    if (JSON.stringify(existingCustomer) !== JSON.stringify(dto.customer)) {
      return false;
    }

    // Compare Items
    if (existing.items.length !== dto.items.length) {
      return false;
    }

    // Sort and compare
    // This is O(N log N) or O(N^2) depending on impl. N is small.
    const sortedExisting = [...existing.items].sort((a, b) =>
      a.sku.localeCompare(b.sku),
    );
    const sortedDto = [...dto.items].sort((a, b) => a.sku.localeCompare(b.sku));

    for (let i = 0; i < sortedExisting.length; i++) {
      if (
        sortedExisting[i].sku !== sortedDto[i].sku ||
        sortedExisting[i].qty !== sortedDto[i].qty
      ) {
        return false;
      }
    }

    return true;
  }

  private calculateHash(prevHash: string, data: string): string {
    return crypto
      .createHash('sha256')
      .update(prevHash + data)
      .digest('hex');
  }
}

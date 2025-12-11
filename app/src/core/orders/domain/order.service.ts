import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { CreateOrderDto } from '../gateway/dto/create-order.dto';
import { Order } from './order.entity';
import { IOrderRepository } from './order.repository.interface';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class OrderService {
  constructor(
    @Inject(IOrderRepository)
    private readonly orderRepository: IOrderRepository,
    private readonly auditLogsService: AuditLogsService,
    private readonly prisma: PrismaService,
  ) {}

  async createOrder(tenantId: string, dto: CreateOrderDto): Promise<Order> {
    // 1. Idempotency Check
    const existingOrder = await this.orderRepository.findByExternalId(
      tenantId,
      dto.externalId,
    );

    if (existingOrder) {
      if (this.isOrderContentEqual(existingOrder, dto)) {
        return existingOrder;
      } else {
        throw new ConflictException(
          'Order with same externalId but different content exists',
        );
      }
    }

    // 2. Create Transaction (delegated to repository)
    // We start the transaction here to include Audit Log in the same transaction unit
    return this.prisma.$transaction(async (tx) => {
      const order = await this.orderRepository.create(
        {
          tenantId,
          externalId: dto.externalId,
          customer: dto.customer,
          items: dto.items,
        },
        tx,
      );

      // 3. Audit Log
      await this.auditLogsService.createLog(
        tenantId,
        'ORDER_CREATED',
        {
          orderId: order.id,
          externalId: order.externalId,
          items: dto.items,
        },
        tx,
      );

      return order;
    });
  }

  async shipOrder(tenantId: string, orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(tenantId, orderId);
    if (!order) {
        throw new ConflictException('Order not found'); // Or NotFound, but task says Conflict for invalid state
    }
    
    if (order.status !== 'PENDING') {
        throw new ConflictException(`Cannot ship order in status ${order.status}`);
    }

    return this.prisma.$transaction(async (tx) => {
        // 1. Update Status
        const updatedOrder = await this.orderRepository.updateStatus(tenantId, orderId, 'SHIPPED', tx);

        // 2. Adjust Stock (Reserved -> 0)
        // Task says: "корректируем сток (опционально: уменьшаем reserved, либо ведём отдельный учёт)"
        // Since we decremented available on create, and incremented reserved.
        // Now we should decrement reserved.
        for (const item of order.items) {
             await tx.stockLevel.updateMany({
                where: { tenantId, sku: item.sku },
                data: { reserved: { decrement: item.qty } }
             });
        }

        // 3. Audit Log
        await this.auditLogsService.createLog(tenantId, 'ORDER_SHIPPED', { orderId }, tx);

        return updatedOrder;
    });
  }

  private isOrderContentEqual(existing: Order, dto: CreateOrderDto): boolean {
    // Compare Customer
    // Cast existing.customer to any or specific type
    const existingCustomer = existing.customer;
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
}

import {
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateOrderDto } from '../gateway/dto/create-order.dto';
import { Order } from './order.entity';
import { IOrderRepository } from './order.repository.interface';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { StockService } from '../../stock/domain/stock.service';
import { MetricsService } from '../../../infrastructure/metrics/metrics.service';

@Injectable()
export class OrderService {
  constructor(
    @Inject(IOrderRepository)
    private readonly orderRepository: IOrderRepository,
    private readonly auditLogsService: AuditLogsService,
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly metricsService: MetricsService,
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

    // 2. Check Stock Availability
    const stockErrors = await this.stockService.checkStockAvailability(
      tenantId,
      dto.items,
    );

    if (stockErrors.length > 0) {
      throw new UnprocessableEntityException({
        message: 'Insufficient stock',
        errors: stockErrors,
      });
    }

    // 3. Create Transaction (delegated to repository)
    // We start the transaction here to include Audit Log in the same transaction unit
    const createdOrder = await this.prisma.$transaction(async (tx) => {
      // 3.1 Reserve Stock
      for (const item of dto.items) {
        await tx.stockLevel.updateMany({
          where: { tenantId, sku: item.sku },
          data: {
            available: { decrement: item.qty },
            reserved: { increment: item.qty },
          },
        });
      }

      const order = await this.orderRepository.create(
        {
          tenantId,
          externalId: dto.externalId,
          customer: dto.customer,
          items: dto.items,
        },
        tx,
      );

      // 4. Audit Log
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

    this.metricsService.ordersCreatedTotal.inc();
    return createdOrder;
  }

  async shipOrder(tenantId: string, orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(tenantId, orderId);
    if (!order) {
      throw new ConflictException('Order not found');
    }

    if (order.status !== 'PENDING') {
      throw new ConflictException(
        `Cannot ship order in status ${order.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Status
      const updatedOrder = await this.orderRepository.updateStatus(
        tenantId,
        orderId,
        'SHIPPED',
        tx,
      );

      // 2. Adjust Stock (Reserved -> 0)
      for (const item of order.items) {
        await tx.stockLevel.updateMany({
          where: { tenantId, sku: item.sku },
          data: { reserved: { decrement: item.qty } },
        });
      }

      // 3. Audit Log
      await this.auditLogsService.createLog(
        tenantId,
        'ORDER_SHIPPED',
        { orderId },
        tx,
      );

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

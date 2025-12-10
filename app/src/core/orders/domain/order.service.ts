import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { CreateOrderDto } from '../gateway/dto/create-order.dto';
import { Order } from './order.entity';
import { IOrderRepository } from './order.repository.interface';

@Injectable()
export class OrderService {
  constructor(
    @Inject(IOrderRepository)
    private readonly orderRepository: IOrderRepository,
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
    return this.orderRepository.create({
      tenantId,
      externalId: dto.externalId,
      customer: dto.customer,
      items: dto.items,
    });
  }

  private isOrderContentEqual(existing: Order, dto: CreateOrderDto): boolean {
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
}

import { Injectable } from '@nestjs/common';
import { OrderRepository } from '../adapters/prisma/order.repository';
// import { OrderQueueService } from '../adapters/bull/order-queue.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    // private readonly orderQueueService: OrderQueueService
  ) {}

  // Business logic methods will go here
}

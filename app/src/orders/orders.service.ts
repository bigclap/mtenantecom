import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  create(tenantId: string, createOrderDto: CreateOrderDto) {
    return 'This action adds a new order';
  }

  ship(tenantId: string, orderId: string) {
    return `This action ships order #${orderId}`;
  }
}

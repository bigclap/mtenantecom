import { Controller, Post, Body, UseGuards, Param, HttpCode } from '@nestjs/common';
import { OrdersService } from '../domain/orders.service';
import { CreateOrderDto } from './create-order.dto';
import { ApiKeyGuard } from '../../../infrastructure/auth/api-key.guard';

@Controller('api/tenants/:tenantId/orders')
@UseGuards(ApiKeyGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(
    @Param('tenantId') tenantId: string,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(tenantId, createOrderDto);
  }
}

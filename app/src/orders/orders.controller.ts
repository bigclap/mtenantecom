import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { TenantAuthGuard } from '../tenants/tenant-auth.guard';

@Controller('api/tenants/:tenantId/orders')
@UseGuards(TenantAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Param('tenantId') tenantId: string, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(tenantId, createOrderDto);
  }

  @Post(':orderId/ship')
  ship(@Param('tenantId') tenantId: string, @Param('orderId') orderId: string) {
    return this.ordersService.ship(tenantId, orderId);
  }
}

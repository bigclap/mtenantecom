import { Controller, Post, Param, UseGuards, HttpCode } from '@nestjs/common';
import { OrdersService } from '../domain/orders.service';
import { ApiKeyGuard } from '../../../infrastructure/auth/api-key.guard';

@Controller('api/tenants/:tenantId/orders')
@UseGuards(ApiKeyGuard)
export class OrdersShipmentController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post(':orderId/ship')
  @HttpCode(200)
  async shipOrder(
    @Param('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.shipOrder(tenantId, orderId);
  }
}

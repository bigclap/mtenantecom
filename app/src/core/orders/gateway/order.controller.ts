import {
  Controller,
  Post,
  Body,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderService } from '../domain/order.service';
import { TenantAuthGuard } from '../../../infrastructure/auth/tenant-auth.guard';
import { ClsService } from 'nestjs-cls';

@ApiTags('orders')
@UseGuards(TenantAuthGuard)
@ApiHeader({ name: 'x-api-key', required: true })
@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly cls: ClsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 422, description: 'Insufficient stock' })
  async create(@Body() dto: CreateOrderDto) {
    // TenantId is injected by Guard into CLS context
    const tenantId = this.cls.get('tenantId');
    return this.orderService.createOrder(tenantId, dto);
  }

  @Post(':orderId/ship')
  @ApiOperation({ summary: 'Ship an order' })
  @ApiResponse({ status: 200, description: 'Order shipped' })
  @ApiResponse({ status: 409, description: 'Order cannot be shipped (wrong status)' })
  async ship(@Param('orderId') orderId: string) {
    const tenantId = this.cls.get('tenantId');
    return this.orderService.shipOrder(tenantId, orderId);
  }
}
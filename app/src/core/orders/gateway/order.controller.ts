import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { OrderService } from '../domain/order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantAuthGuard } from '../../../infrastructure/auth/tenant-auth.guard';
import { ClsService } from 'nestjs-cls';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly cls: ClsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  async create(@Body() createOrderDto: CreateOrderDto) {
    const tenantId = this.cls.get<string>('tenantId');
    return this.orderService.createOrder(tenantId, createOrderDto);
  }
}

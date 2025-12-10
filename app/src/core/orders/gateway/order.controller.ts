import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { OrderService } from '../domain/order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantAuthGuard } from '../../../infrastructure/auth/tenant-auth.guard';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  async create(@Body() createOrderDto: CreateOrderDto) {
    // Call service
    return { status: 'received' };
  }
}

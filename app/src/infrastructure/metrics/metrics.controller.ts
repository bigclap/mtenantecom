import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('metrics')
export class MetricsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getMetrics() {
    // Simple count metrics as requested
    const ordersCreated = await this.prisma.order.count();
    const webhookErrors = 0; // Need to track this somewhere if needed, or query logs
    const returnsFailed = await this.prisma.return.count({ where: { status: 'FAILED' } });

    // For BullMQ queue size, we would need to inject the queue and call getCount
    // But queue is in ReturnsModule.
    // For now returning DB stats.

    return {
      orders_created_total: ordersCreated,
      webhook_errors_total: webhookErrors,
      returns_failed_total: returnsFailed,
      // returns_queue_size: ...
    };
  }
}

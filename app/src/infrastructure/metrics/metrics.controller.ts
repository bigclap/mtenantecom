import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

@ApiTags('System')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}
  @Get()
  @ApiOperation({ summary: 'Get application metrics' })
  async getMetrics() {
    // In a real app, this would return Prometheus metrics or similar.
    // For now, return a simple JSON status including memory usage.
    const memoryUsage = process.memoryUsage();
    const [
      ordersCreatedTotal,
      webhookErrorsTotal,
      returnsFailedTotal,
      returnsQueueSize,
    ] = [
      this.metricsService.ordersCreatedTotal.get(),
      this.metricsService.webhookErrorsTotal.get(),
      this.metricsService.returnsFailedTotal.get(),
      this.metricsService.returnsQueueSize.get(),
    ];
    return {
      status: 'up',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      },
      ordersCreatedTotal,
      webhookErrorsTotal,
      returnsFailedTotal,
      returnsQueueSize,
    };
  }
}

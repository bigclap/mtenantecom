import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('System')
@Controller('metrics')
export class MetricsController {
  @Get()
  @ApiOperation({ summary: 'Get application metrics' })
  getMetrics() {
    // In a real app, this would return Prometheus metrics or similar.
    // For now, return a simple JSON status including memory usage.
    const memoryUsage = process.memoryUsage();
    return {
      status: 'up',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      },
    };
  }
}

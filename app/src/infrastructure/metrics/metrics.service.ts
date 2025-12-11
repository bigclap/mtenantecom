import { Injectable } from '@nestjs/common';
import { Counter, Gauge, register } from 'prom-client';

@Injectable()
export class MetricsService {
  public readonly ordersCreatedTotal = new Counter({
    name: 'orders_created_total',
    help: 'Total number of orders created',
  });

  public readonly webhookErrorsTotal = new Counter({
    name: 'webhook_errors_total',
    help: 'Total number of webhook errors',
  });

  public readonly returnsFailedTotal = new Counter({
    name: 'returns_failed_total',
    help: 'Total number of failed returns processing',
  });

  public readonly returnsQueueSize = new Gauge({
    name: 'returns_queue_size',
    help: 'Current size of the returns queue',
  });

  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}

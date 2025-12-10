import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class OrderQueueService {
  constructor(@InjectQueue('orders') private orderQueue: Queue) {}

  async addOrderJob(data: any) {
    await this.orderQueue.add('process-order', data);
  }
}

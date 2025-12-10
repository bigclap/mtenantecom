import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class ReturnQueueService {
  constructor(@InjectQueue('returns') private returnQueue: Queue) {}

  async addReturnJob(data: any) {
    // data should contain tenantId context and return details
    await this.returnQueue.add('process-return', data, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  }
}

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MetricsService } from '../../../../infrastructure/metrics/metrics.service';
import { ReturnProcessingJobDto } from '../../gateway/dto/return-processing-job.dto';

@Injectable()
export class ReturnQueueService implements OnModuleInit, OnModuleDestroy {
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    @InjectQueue('returns') private returnQueue: Queue,
    private readonly metricsService: MetricsService,
  ) {}

  onModuleInit() {
    this.startMetricsCollection();
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private startMetricsCollection() {
    // Update queue size every 5 seconds
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.intervalId = setInterval(async () => {
      try {
        const count = await this.returnQueue.getJobCounts(
          'active',
          'waiting',
          'delayed',
        );
        const total = count.active + count.waiting + count.delayed;
        this.metricsService.returnsQueueSize.set(total);
      } catch {
        // Silently fail or log error if queue is unreachable
      }
    }, 5000);
  }

  async addReturnJob(data: ReturnProcessingJobDto) {
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

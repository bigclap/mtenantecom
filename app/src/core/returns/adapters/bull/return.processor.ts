import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ReturnService } from '../../domain/return.service';
import { ClsService } from 'nestjs-cls';
import { MetricsService } from '../../../../infrastructure/metrics/metrics.service';
import { ReturnProcessingJobDto } from '../../gateway/dto/return-processing-job.dto';

@Processor('returns')
@Injectable()
export class ReturnProcessor extends WorkerHost {
  private readonly logger = new Logger(ReturnProcessor.name);

  constructor(
    private readonly returnService: ReturnService,
    private readonly cls: ClsService,
    private readonly metricsService: MetricsService,
  ) {
    super();
  }

  async process(
    job: Job<ReturnProcessingJobDto, unknown, string>,
  ): Promise<void> {
    const { tenantId, returnId } = job.data;
    this.logger.log(`Processing return ${returnId} for tenant ${tenantId}`);

    // Restore Context

    await this.cls.runWith({ tenantId } as { tenantId: string }, async () => {
      try {
        await this.returnService.processReturn(tenantId, returnId);
        this.logger.log(`Return ${returnId} processed successfully`);
      } catch (error) {
        this.logger.error(
          `Failed to process return ${returnId}`,
          error instanceof Error ? error.stack : String(error),
        );
        throw error; // Let BullMQ handle retries
      }
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ReturnProcessingJobDto>, error: Error) {
    const { tenantId, returnId } = job.data;
    // Check if the job has exhausted all attempts
    // If job.opts.attempts is undefined, it defaults to 1.
    // job.attemptsMade includes the current attempt that just failed.
    const attempts = job.opts.attempts || 1;
    if (job.attemptsMade >= attempts) {
      this.logger.warn(
        `Job ${job.id} failed permanently for return ${returnId} (Tenant: ${tenantId}). Marking as FAILED.`,
      );

      await this.cls.runWith({ tenantId } as { tenantId: string }, async () => {
        await this.returnService.markAsFailed(
          tenantId,
          returnId,
          error.message,
        );
      });

      this.metricsService.returnsFailedTotal.inc();
    }
  }
}

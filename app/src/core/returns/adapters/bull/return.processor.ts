import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ReturnService } from '../../domain/return.service';

interface ReturnJobData {
  tenantId: string;
  returnId: string;
}

@Processor('returns')
export class ReturnProcessor extends WorkerHost {
  private readonly logger = new Logger(ReturnProcessor.name);

  constructor(private readonly returnService: ReturnService) {
    super();
  }

  async process(job: Job<ReturnJobData, any, string>): Promise<any> {
    const { tenantId, returnId } = job.data;
    this.logger.log(`Processing return ${returnId} for tenant ${tenantId}`);

    try {
      // Restore CLS context if we were using it (simplified here)
      await this.returnService.processReturn(tenantId, returnId);
      this.logger.log(`Return ${returnId} processed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process return ${returnId}`, error);
      throw error; // BullMQ will handle retries
    }
  }
}

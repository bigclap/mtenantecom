import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ReturnService } from '../../domain/return.service';
import { ClsService } from 'nestjs-cls';

@Processor('returns')
@Injectable()
export class ReturnProcessor extends WorkerHost {
  private readonly logger = new Logger(ReturnProcessor.name);

  constructor(
    private readonly returnService: ReturnService,
    private readonly cls: ClsService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { tenantId, returnId, traceId } = job.data;
    this.logger.log(`Processing return ${returnId} for tenant ${tenantId}`);

    // Restore Context
    return this.cls.runWith(
      { tenantId } as any, // Ensure tenantId is available in CLS
      async () => {
        try {
          await this.returnService.processReturn(tenantId, returnId);
          this.logger.log(`Return ${returnId} processed successfully`);
        } catch (error) {
          this.logger.error(
            `Failed to process return ${returnId}`,
            error.stack,
          );
          throw error; // Let BullMQ handle retries
        }
      },
    );
  }
}

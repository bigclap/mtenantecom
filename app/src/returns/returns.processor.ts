import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('returns')
export class ReturnsProcessor extends WorkerHost {
  async process(job: Job<any, any, string>): Promise<any> {
    // Process placeholder
  }
}

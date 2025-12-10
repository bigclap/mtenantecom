import { Module } from '@nestjs/common';
import { WebhookService } from './domain/webhook.service';
import { WebhookController } from './gateway/webhook.controller';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditLogsModule } from '../../core/audit-logs/audit-logs.module';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}

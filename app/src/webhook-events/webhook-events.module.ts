import { Module } from '@nestjs/common';
import { WebhookEventsService } from './webhook-events.service';
import { WebhookEventsController } from './webhook-events.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [WebhookEventsController],
  providers: [WebhookEventsService, AuditLogsService],
})
export class WebhookEventsModule {}

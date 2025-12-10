import { Module } from '@nestjs/common';
import { WebhookEventsService } from './webhook-events.service';

@Module({
  providers: [WebhookEventsService],
  exports: [WebhookEventsService],
})
export class WebhookEventsModule {}

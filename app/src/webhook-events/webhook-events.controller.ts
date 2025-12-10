import { Controller, Post, Body } from '@nestjs/common';
import { WebhookEventsService } from './webhook-events.service';
import { WebhookDto } from './dto/webhook.dto';

@Controller('api/webhooks/shop')
export class WebhookEventsController {
  constructor(private readonly webhookEventsService: WebhookEventsService) {}

  @Post('order-updated')
  handle(@Body() dto: WebhookDto) {
    return this.webhookEventsService.handleWebhook(dto);
  }
}

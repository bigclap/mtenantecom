import { Injectable } from '@nestjs/common';
import { WebhookDto } from './dto/webhook.dto';

@Injectable()
export class WebhookEventsService {
  handleWebhook(dto: WebhookDto) {
    return 'This action handles a webhook';
  }
}

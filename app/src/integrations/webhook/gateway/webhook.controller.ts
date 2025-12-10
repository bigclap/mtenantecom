import { Controller, Post, Body, HttpCode, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { WebhookService } from '../domain/webhook.service';
import { WebhookDto } from './webhook.dto';

@Controller('api/webhooks/shop')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('order-updated')
  @HttpCode(200)
  async handleOrderUpdated(@Body() dto: WebhookDto) {
    return this.webhookService.handleOrderUpdated(dto);
  }
}

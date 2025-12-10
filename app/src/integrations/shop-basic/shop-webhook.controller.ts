import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('webhooks')
@Controller('webhooks/shop')
export class ShopWebhookController {
  @Post('order-updated')
  @ApiOperation({ summary: 'Handle order updated webhook from shop' })
  handleOrderUpdated(/* @Body() _webhookDto: ShopWebhookDto */) {
    // Implementation of webhook processing
    return { status: 'received' };
  }
}

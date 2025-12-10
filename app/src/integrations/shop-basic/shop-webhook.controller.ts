import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ShopWebhookDto } from './dto/shop-webhook.dto';

@ApiTags('webhooks')
@Controller('webhooks/shop')
export class ShopWebhookController {
  @Post('order-updated')
  @ApiOperation({ summary: 'Handle order updated webhook from shop' })
  async handleOrderUpdated(@Body() webhookDto: ShopWebhookDto) {
    // Implementation of webhook processing
    return { status: 'received' };
  }
}

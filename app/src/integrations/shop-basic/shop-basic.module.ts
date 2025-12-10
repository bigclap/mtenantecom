import { Module } from '@nestjs/common';
import { ShopWebhookController } from './shop-webhook.controller';

@Module({
  controllers: [ShopWebhookController],
  providers: [],
  exports: [],
})
export class ShopBasicModule {}

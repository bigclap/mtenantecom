import { Module } from '@nestjs/common';
import { ShopWebhookController } from './shop-webhook.controller';
import { TenantApiKeysModule } from '../../core/tenant-api-keys/tenant-api-keys.module';
import { WebhookEventsModule } from '../../core/webhook-events/webhook-events.module';
import { OrdersModule } from '../../core/orders/orders.module';
import { AuditLogsModule } from '../../core/audit-logs/audit-logs.module';

@Module({
  imports: [
    TenantApiKeysModule,
    WebhookEventsModule,
    OrdersModule,
    AuditLogsModule,
  ],
  controllers: [ShopWebhookController],
  providers: [],
  exports: [],
})
export class ShopBasicModule {}

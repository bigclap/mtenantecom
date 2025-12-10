import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ShopWebhookDto } from './dto/shop-webhook.dto';
import { TenantApiKeysService } from '../../core/tenant-api-keys/tenant-api-keys.service';
import { WebhookEventsService } from '../../core/webhook-events/webhook-events.service';
import { OrderService } from '../../core/orders/domain/order.service';
import { AuditLogsService } from '../../core/audit-logs/audit-logs.service';
import * as crypto from 'crypto';

@ApiTags('webhooks')
@Controller('webhooks/shop')
export class ShopWebhookController {
  constructor(
    private readonly tenantApiKeysService: TenantApiKeysService,
    private readonly webhookEventsService: WebhookEventsService,
    private readonly orderService: OrderService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Post(':tenantExternalId/order-updated')
  @ApiOperation({ summary: 'Handle order updated webhook from shop' })
  @ApiParam({
    name: 'tenantExternalId',
    description: 'External ID of the tenant',
  })
  @HttpCode(HttpStatus.OK)
  async handleOrderUpdated(
    @Param('tenantExternalId') tenantExternalId: string,
    @Headers('x-shop-signature') signature: string,
    @Body() dto: ShopWebhookDto,
  ) {
    // 1. Find Tenant
    const apiKey =
      await this.tenantApiKeysService.findByExternalId(tenantExternalId);
    if (!apiKey) {
      throw new NotFoundException(
        `Tenant with externalId ${tenantExternalId} not found`,
      );
    }

    // 2. Validate Signature
    if (!signature) {
      throw new UnauthorizedException('Missing signature');
    }

    // Note: In a production environment with strict security requirements,
    // we should use the raw request body buffer to compute the HMAC signature.
    // Using JSON.stringify(dto) is an approximation that assumes the payload
    // structure and serialization are identical to the sender's.
    const computedSignature = crypto
      .createHmac('sha256', apiKey.secret)
      .update(JSON.stringify(dto))
      .digest('hex');

    if (signature !== computedSignature) {
      throw new ForbiddenException('Invalid signature');
    }

    // 3. Idempotency
    const isNew = await this.webhookEventsService.saveEvent(
      apiKey.tenantId,
      dto.eventId,
      dto,
    );

    if (!isNew) {
      return { status: 'ignored', reason: 'duplicate' };
    }

    // 4. Map to Command and Execute
    await this.orderService.createOrder(apiKey.tenantId, {
      externalId: dto.orderId,
      customer: dto.customer,
      items: dto.items,
    });

    // 5. Audit
    await this.auditLogsService.createLog(
      apiKey.tenantId,
      'ORDER_SYNCED_FROM_WEBHOOK',
      { eventId: dto.eventId, orderId: dto.orderId },
    );

    return { status: 'processed' };
  }
}

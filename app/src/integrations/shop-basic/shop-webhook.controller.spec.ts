import { Test, TestingModule } from '@nestjs/testing';
import { ShopWebhookController } from './shop-webhook.controller';
import { TenantApiKeysService } from '../../core/tenant-api-keys/tenant-api-keys.service';
import { WebhookEventsService } from '../../core/webhook-events/webhook-events.service';
import { OrderService } from '../../core/orders/domain/order.service';
import { AuditLogsService } from '../../core/audit-logs/audit-logs.service';
import { ShopWebhookDto } from './dto/shop-webhook.dto';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { TenantApiKey, AuditLog } from '@prisma/client';
import { Order, OrderStatus } from '../../core/orders/domain/order.entity';

describe('ShopWebhookController', () => {
  let controller: ShopWebhookController;
  let tenantApiKeysService: jest.Mocked<TenantApiKeysService>;
  let webhookEventsService: jest.Mocked<WebhookEventsService>;
  let orderService: jest.Mocked<OrderService>;
  let auditLogsService: jest.Mocked<AuditLogsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShopWebhookController],
      providers: [
        {
          provide: TenantApiKeysService,
          useValue: {
            findByExternalId: jest.fn(),
          },
        },
        {
          provide: WebhookEventsService,
          useValue: {
            saveEvent: jest.fn(),
          },
        },
        {
          provide: OrderService,
          useValue: {
            createOrder: jest.fn(),
          },
        },
        {
          provide: AuditLogsService,
          useValue: {
            createLog: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ShopWebhookController>(ShopWebhookController);
    tenantApiKeysService = module.get(TenantApiKeysService);
    webhookEventsService = module.get(WebhookEventsService);
    orderService = module.get(OrderService);
    auditLogsService = module.get(AuditLogsService);
  });

  const tenantId = 'tenant-1';
  const tenantExternalId = 'store-abc';
  const secret = 'test-secret';
  const dto: ShopWebhookDto = {
    eventId: 'evt-1',
    orderId: 'ord-1',
    customer: { name: 'John' },
    items: [{ sku: 'A', qty: 1 }],
  };

  const validSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(dto))
    .digest('hex');

  const mockApiKey: TenantApiKey = {
    id: 'key-1',
    tenantId,
    key: 'k',
    secret,
    externalId: tenantExternalId,
    isActive: true,
    createdAt: new Date(),
  };

  const mockOrder: Order = {
    id: 'order-1',
    tenantId,
    externalId: dto.orderId,
    status: OrderStatus.PENDING,
    customer: dto.customer,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuditLog: AuditLog = {
    id: 'log-1',
    tenantId,
    eventType: 'ORDER_SYNCED_FROM_WEBHOOK',
    payload: { eventId: dto.eventId, orderId: dto.orderId },
    createdAt: new Date(),
    prevHash: null,
    hash: 'hash-1',
  };

  it('should process webhook successfully?', async () => {
    tenantApiKeysService.findByExternalId.mockResolvedValue(mockApiKey);
    webhookEventsService.saveEvent.mockResolvedValue(true);
    orderService.createOrder.mockResolvedValue(mockOrder);
    auditLogsService.createLog.mockResolvedValue(mockAuditLog);

    const result = await controller.handleOrderUpdated(
      tenantExternalId,
      validSignature,
      dto,
    );

    expect(result).toEqual({ status: 'processed' });
    expect(orderService.createOrder.bind(orderService)).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        externalId: dto.orderId,
      }),
    );

    expect(
      auditLogsService.createLog.bind(auditLogsService),
    ).toHaveBeenCalledWith(
      tenantId,
      'ORDER_SYNCED_FROM_WEBHOOK',
      expect.anything(),
    );
  });

  it('should throw NotFoundException if the tenant is not found', async () => {
    tenantApiKeysService.findByExternalId.mockResolvedValue(null);

    await expect(
      controller.handleOrderUpdated('unknown', validSignature, dto),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw UnauthorizedException if the signature is missing', async () => {
    tenantApiKeysService.findByExternalId.mockResolvedValue(mockApiKey);
    await expect(
      controller.handleOrderUpdated(tenantExternalId, '', dto),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw ForbiddenException if the signature is invalid', async () => {
    tenantApiKeysService.findByExternalId.mockResolvedValue({
      ...mockApiKey,
      secret: 'wrong-secret',
    });

    await expect(
      controller.handleOrderUpdated(tenantExternalId, 'invalid-sig', dto),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should return ignored if duplicate event', async () => {
    tenantApiKeysService.findByExternalId.mockResolvedValue(mockApiKey);
    webhookEventsService.saveEvent.mockResolvedValue(false);

    const result = await controller.handleOrderUpdated(
      tenantExternalId,
      validSignature,
      dto,
    );

    expect(result).toEqual({ status: 'ignored', reason: 'duplicate' });
    expect(orderService.createOrder.bind(orderService)).not.toHaveBeenCalled();
  });
});

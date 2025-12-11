import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/infrastructure/prisma/prisma.service';
import { TenantApiKeysService } from './../src/core/tenant-api-keys/tenant-api-keys.service';
import * as crypto from 'crypto';
import { ShopWebhookDto } from './../src/integrations/shop-basic/dto/shop-webhook.dto';

describe('ShopWebhookController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantApiKeysService: TenantApiKeysService;
  let tenantId: string;
  let tenantExternalId: string;
  let apiSecret: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    tenantApiKeysService = app.get<TenantApiKeysService>(TenantApiKeysService);

    // Setup Tenant and API Key with externalId
    const tenant = await prisma.tenant.create({
      data: { name: 'Webhook Test Tenant' },
    });
    tenantId = tenant.id;
    tenantExternalId = 'tenant-ext-001';

    const key = await tenantApiKeysService.createKey(
      tenantId,
      tenantExternalId,
    );
    apiSecret = key.secret;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.orderItem.deleteMany({ where: { order: { tenantId } } });
    await prisma.order.deleteMany({ where: { tenantId } });
    await prisma.stockLevel.deleteMany({ where: { tenantId } });
    await prisma.webhookEvent.deleteMany({ where: { tenantId } });
    await prisma.tenantApiKey.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  it('/webhooks/shop/:tenantExternalId/order-updated (POST) - success', async () => {
    const dto: ShopWebhookDto = {
      eventId: 'evt-001',
      orderId: 'ord-web-001',
      customer: {
        name: 'Webhook User',
        email: 'webhook@example.com',
      },
      items: [{ sku: 'SKU-WEB-1', qty: 1 }],
    };

    // Ensure stock
    await prisma.stockLevel.create({
      data: {
        tenantId,
        sku: 'SKU-WEB-1',
        available: 10,
        reserved: 0,
      },
    });

    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(JSON.stringify(dto))
      .digest('hex');

    return request(app.getHttpServer())
      .post(`/webhooks/shop/${tenantExternalId}/order-updated`)
      .set('x-shop-signature', signature)
      .send(dto)
      .expect(200)
      .expect({ status: 'processed' });
  });

  it('/webhooks/shop/:tenantExternalId/order-updated (POST) - idempotency', async () => {
    const dto: ShopWebhookDto = {
      eventId: 'evt-002',
      orderId: 'ord-web-002',
      customer: {
        name: 'Webhook User 2',
      },
      items: [{ sku: 'SKU-WEB-2', qty: 1 }],
    };

    // Ensure stock
    await prisma.stockLevel.create({
      data: {
        tenantId,
        sku: 'SKU-WEB-2',
        available: 10,
        reserved: 0,
      },
    });

    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(JSON.stringify(dto))
      .digest('hex');

    // First request
    await request(app.getHttpServer())
      .post(`/webhooks/shop/${tenantExternalId}/order-updated`)
      .set('x-shop-signature', signature)
      .send(dto)
      .expect(200)
      .expect({ status: 'processed' });

    // Second request
    await request(app.getHttpServer())
      .post(`/webhooks/shop/${tenantExternalId}/order-updated`)
      .set('x-shop-signature', signature)
      .send(dto)
      .expect(200)
      .expect({ status: 'ignored', reason: 'duplicate' });
  });

  it('/webhooks/shop/:tenantExternalId/order-updated (POST) - invalid signature', async () => {
    const dto: ShopWebhookDto = {
      eventId: 'evt-003',
      orderId: 'ord-web-003',
      customer: { name: 'Hacker' },
      items: [],
    };

    const signature = 'invalid-signature';

    return request(app.getHttpServer())
      .post(`/webhooks/shop/${tenantExternalId}/order-updated`)
      .set('x-shop-signature', signature)
      .send(dto)
      .expect(403);
  });
});

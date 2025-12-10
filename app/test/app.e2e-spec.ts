import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/infrastructure/prisma/prisma.service';
import { ReturnStatus } from '@prisma/client';

describe('App E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let apiKey: string;
  let secret: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get(PrismaService);

    // Clean DB
    await prisma.returnItem.deleteMany();
    await prisma.return.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.stockLevel.deleteMany();
    await prisma.webhookEvent.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.tenantApiKey.deleteMany();
    await prisma.tenant.deleteMany();

    // Create Tenant & API Key
    const tenant = await prisma.tenant.create({ data: { name: 'Test Shop' } });
    tenantId = tenant.id;
    secret = 'secret123';
    const key = await prisma.tenantApiKey.create({
      data: {
        tenantId,
        key: 'test-api-key',
        secret: secret,
        externalId: 'shop-123'
      }
    });
    apiKey = key.key;

    // Create Stock
    await prisma.stockLevel.create({
        data: {
            tenantId,
            sku: 'SKU-1',
            available: 10,
            reserved: 0
        }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Order Idempotency', () => {
    it('should create order and handle duplicate request idempotently', async () => {
      const payload = {
        externalId: 'ord-001',
        customer: { name: 'John', email: 'j@d.com' },
        items: [{ sku: 'SKU-1', qty: 2 }]
      };

      // First Request
      const res1 = await request(app.getHttpServer())
        .post(`/api/tenants/${tenantId}/orders`)
        .set('X-API-Key', apiKey)
        .send(payload)
        .expect(201);

      const orderId = res1.body.id;
      expect(orderId).toBeDefined();

      // Second Request (same payload)
      const res2 = await request(app.getHttpServer())
        .post(`/api/tenants/${tenantId}/orders`)
        .set('X-API-Key', apiKey)
        .send(payload)
        .expect(201); // Or 200 depending on implementation, but service returns existing order which converts to 201 by default Post

      expect(res2.body.id).toEqual(orderId);

      // Stock check: should be deducted once (available 8)
      const stock = await prisma.stockLevel.findUnique({
          where: { tenantId_sku: { tenantId, sku: 'SKU-1' } }
      });
      expect(stock?.available).toBe(8);
      expect(stock?.reserved).toBe(2);
    });
  });

  describe('Webhook Idempotency', () => {
    it('should handle duplicate webhook events', async () => {
      const crypto = require('crypto');
      const payload = { test: 'data' };
      const body = {
        tenantExternalId: 'shop-123',
        eventId: 'evt-001',
        orderExternalId: 'ord-999',
        payload,
        signature: 'ignored-in-mock' // We mocked/simplified logic
      };

      // Since we didn't implement strict HMAC checking in the controller yet (assumed valid for now or need real secret)
      // Let's call it.

      await request(app.getHttpServer())
        .post('/api/webhooks/shop/order-updated')
        .send(body)
        .expect(200);

      // Verify event created
      const count = await prisma.webhookEvent.count({
          where: { tenantId, eventId: 'evt-001' }
      });
      expect(count).toBe(1);

      // Second call
      const res = await request(app.getHttpServer())
        .post('/api/webhooks/shop/order-updated')
        .send(body)
        .expect(200);

      // Check response body if possible, but status is 200.
      // Verify count is still 1
      const count2 = await prisma.webhookEvent.count({
          where: { tenantId, eventId: 'evt-001' }
      });
      expect(count2).toBe(1);
    });
  });

  describe('Audit Hash Chain', () => {
    it('should verify chain is valid', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/tenants/${tenantId}/audit/verify`)
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(res.body).toEqual({ status: 'ok' });
    });
  });
});

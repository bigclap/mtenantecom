import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/infrastructure/prisma/prisma.service';
import { TenantApiKeysService } from './../src/core/tenant-api-keys/tenant-api-keys.service';
import { CreateOrderDto } from './../src/core/orders/gateway/dto/create-order.dto';

describe('OrderController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantApiKeysService: TenantApiKeysService;
  let tenantId: string;
  let apiKey: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    tenantApiKeysService = app.get<TenantApiKeysService>(TenantApiKeysService);

    // Setup Tenant and API Key
    const tenant = await prisma.tenant.create({
      data: { name: 'Order Test Tenant' },
    });
    tenantId = tenant.id;

    const key = await tenantApiKeysService.createKey(tenantId);
    apiKey = key.key;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.orderItem.deleteMany({ where: { order: { tenantId } } });
    await prisma.order.deleteMany({ where: { tenantId } });
    await prisma.stockLevel.deleteMany({ where: { tenantId } });
    await prisma.tenantApiKey.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  it('/orders (POST) - create order successfully', async () => {
    const createOrderDto: CreateOrderDto = {
      externalId: 'ord-001',
      customer: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      items: [
        { sku: 'SKU-1', qty: 2 },
      ],
    };

    // First, ensure stock exists for SKU-1
    await prisma.stockLevel.create({
      data: {
        tenantId,
        sku: 'SKU-1',
        available: 10,
        reserved: 0,
      },
    });

    return request(app.getHttpServer())
      .post('/orders')
      .set('x-api-key', apiKey)
      .send(createOrderDto)
      .expect(201)
      .expect((res) => {
        expect(res.body.externalId).toBe('ord-001');
      });
  });

  it('/orders (POST) - idempotency check', async () => {
    const createOrderDto: CreateOrderDto = {
      externalId: 'ord-002',
      customer: {
        name: 'Jane Doe',
      },
      items: [
        { sku: 'SKU-2', qty: 1 },
      ],
    };

    // Ensure stock
    await prisma.stockLevel.create({
      data: {
        tenantId,
        sku: 'SKU-2',
        available: 5,
        reserved: 0,
      },
    });

    // First request
    await request(app.getHttpServer())
      .post('/orders')
      .set('x-api-key', apiKey)
      .send(createOrderDto)
      .expect(201);

    // Second request with same externalId
    await request(app.getHttpServer())
      .post('/orders')
      .set('x-api-key', apiKey)
      .send(createOrderDto)
      .expect(201) // Expect 201 (success) but it should be the same order
      .expect((res) => {
        expect(res.body.externalId).toBe('ord-002');
      });
  });
});

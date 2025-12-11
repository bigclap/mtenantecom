import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/infrastructure/prisma/prisma.service';
import { TenantApiKeysService } from './../src/core/tenant-api-keys/tenant-api-keys.service';
import { CreateOrderDto } from './../src/core/orders/gateway/dto/create-order.dto';

describe('OrderController - Ship Order (e2e)', () => {
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
      data: { name: 'Ship Order Test Tenant' },
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

  it('/orders/:orderId/ship (POST) - ship order successfully', async () => {
    // 1. Create Stock
    await prisma.stockLevel.create({
      data: {
        tenantId,
        sku: 'SKU-SHIP-1',
        available: 10,
        reserved: 0,
      },
    });

    // 2. Create Order
    const createOrderDto: CreateOrderDto = {
      externalId: 'ord-ship-1',
      customer: { name: 'Test' },
      items: [{ sku: 'SKU-SHIP-1', qty: 2 }],
    };

    const createRes = await request(app.getHttpServer() as App)
      .post('/orders')
      .set('x-api-key', apiKey)
      .send(createOrderDto)
      .expect(201);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const orderId = createRes.body.id as string;

    // Verify stock reserved
    let stock = await prisma.stockLevel.findUnique({
      where: { tenantId_sku: { tenantId, sku: 'SKU-SHIP-1' } },
    });
    expect(stock!.available).toBe(8);
    expect(stock!.reserved).toBe(2);

    // 3. Ship Order
    await request(app.getHttpServer() as App)
      .post(`/orders/${orderId}/ship`)
      .set('x-api-key', apiKey)
      .expect(201); // NestJS default for POST is 201

    // 4. Verify Stock (reserved cleared)
    stock = await prisma.stockLevel.findUnique({
      where: { tenantId_sku: { tenantId, sku: 'SKU-SHIP-1' } },
    });
    expect(stock!.available).toBe(8);
    expect(stock!.reserved).toBe(0);

    // 5. Verify Order Status
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order!.status).toBe('SHIPPED');

    // 6. Verify Audit Log
    const log = await prisma.auditLog.findFirst({
      where: { tenantId, eventType: 'ORDER_SHIPPED' },
    });
    expect(log).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect((log!.payload as any).orderId).toBe(orderId);
  });

  it('/orders/:orderId/ship (POST) - fail if already shipped', async () => {
    // 1. Create Stock
    await prisma.stockLevel.create({
      data: {
        tenantId,
        sku: 'SKU-SHIP-2',
        available: 10,
        reserved: 0,
      },
    });

    // 2. Create Order
    const createOrderDto: CreateOrderDto = {
      externalId: 'ord-ship-2',
      customer: { name: 'Test' },
      items: [{ sku: 'SKU-SHIP-2', qty: 2 }],
    };

    const createRes = await request(app.getHttpServer() as App)
      .post('/orders')
      .set('x-api-key', apiKey)
      .send(createOrderDto)
      .expect(201);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const orderId = createRes.body.id as string;

    // Manually set to SHIPPED
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED' },
    });

    // 3. Try to Ship
    await request(app.getHttpServer() as App)
      .post(`/orders/${orderId}/ship`)
      .set('x-api-key', apiKey)
      .expect(409);
  });
});

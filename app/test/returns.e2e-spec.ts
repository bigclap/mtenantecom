import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/infrastructure/prisma/prisma.service';
import { TenantApiKeysService } from './../src/core/tenant-api-keys/tenant-api-keys.service';
import { CreateReturnDto } from './../src/core/returns/gateway/dto/create-return.dto';

describe('ReturnController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantApiKeysService: TenantApiKeysService;
  let tenantId: string;
  let apiKey: string;
  let orderId: string;
  let orderItemId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    tenantApiKeysService = app.get<TenantApiKeysService>(TenantApiKeysService);

    // 1. Setup Tenant and API Key
    const tenant = await prisma.tenant.create({
      data: { name: 'Return Test Tenant' },
    });
    tenantId = tenant.id;

    const key = await tenantApiKeysService.createKey(tenantId);
    apiKey = key.key;

    // 2. Setup Stock
    await prisma.stockLevel.create({
      data: { tenantId, sku: 'SKU-RET-1', available: 10, reserved: 0 },
    });

    // 3. Setup Order
    const order = await prisma.order.create({
      data: {
        tenantId,
        externalId: 'ord-ret-1',
        status: 'SHIPPED',
        customer: { name: 'Returner' },
        items: {
          create: [{ tenantId, sku: 'SKU-RET-1', qty: 5 }],
        },
      },
      include: { items: true },
    });
    orderId = order.id;
    orderItemId = order.items[0].id;
  });

  afterAll(async () => {
    // Cleanup
    // We try to delete everything. Order matters due to FKs.
    // If AuditLogs are being written async, we might miss some.
    // We can try to delete AuditLogs last (before Tenant) or multiple times.
    await prisma.returnItem.deleteMany({ where: { return: { tenantId } } });
    await prisma.return.deleteMany({ where: { tenantId } });
    await prisma.orderItem.deleteMany({ where: { order: { tenantId } } });
    await prisma.order.deleteMany({ where: { tenantId } });
    await prisma.stockLevel.deleteMany({ where: { tenantId } });
    await prisma.tenantApiKey.deleteMany({ where: { tenantId } });

    // Delete AuditLogs and WebhookEvents last
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.webhookEvent.deleteMany({ where: { tenantId } });

    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  it('/returns (POST) - create return request', async () => {
    const createReturnDto: CreateReturnDto = {
      orderId: orderId,
      items: [{ sku: 'SKU-RET-1', qty: 2, reason: 'Broken' }],
    };

    const res = await request(app.getHttpServer())
      .post('/returns')
      .set('x-api-key', apiKey)
      .send(createReturnDto)
      .expect(201);

    expect(res.body.status).toBe('PENDING');

    // Wait for async processing (BullMQ)
    // In e2e with real redis, the worker should pick it up.
    // We poll the database for status change to APPROVED

    const maxRetries = 20;
    let found = false;
    for (let i = 0; i < maxRetries; i++) {
      const ret = await prisma.return.findUnique({
        where: { id: res.body.id },
      });
      if (ret && ret.status === 'APPROVED') {
        found = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    expect(found).toBe(true);

    // Check Stock Restock
    const stock = await prisma.stockLevel.findUnique({
      where: { tenantId_sku: { tenantId, sku: 'SKU-RET-1' } },
    });
    // Initial: 10. Order 5 -> Reserved 5.
    // Wait, createOrder doesn't decrement available immediately?
    // Let's check logic.
    // createOrder: available -= qty. So 10 - 5 = 5 available.
    // shipOrder: reserved -= qty.
    // So if order was created manually via prisma in 'beforeAll', stock was NOT updated automatically!
    // I should update stock manually in beforeAll to match order creation state.
    // Order created with qty 5. So available should be 5?
    // Wait, I created stock with available 10.
    // So if I return 2, stock should become 10 + 2? No, I bought 5, so I have 5 left.
    // If I didn't decrement stock when manually creating order, then available is still 10.
    // After return 2, available should become 12.

    expect(stock!.available).toBe(12);

    // Check Audit Log
    const logs = await prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    // Should have RETURN_REQUESTED and RETURN_APPROVED
    const actions = logs.map((l) => l.eventType);
    expect(actions).toContain('RETURN_REQUESTED');
    expect(actions).toContain('RETURN_APPROVED');
  });
});

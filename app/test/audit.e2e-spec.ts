import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/infrastructure/prisma/prisma.service';
import { TenantApiKeysService } from './../src/core/tenant-api-keys/tenant-api-keys.service';
import { AuditLogsService } from './../src/core/audit-logs/audit-logs.service';

describe('AuditController (e2e)', () => {
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
      data: { name: 'Audit Test Tenant' },
    });
    tenantId = tenant.id;

    const key = await tenantApiKeysService.createKey(tenantId);
    apiKey = key.key;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.tenantApiKey.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  it('/audit/verify (GET) - empty chain', () => {
    return request(app.getHttpServer())
      .get('/audit/verify')
      .set('x-api-key', apiKey)
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('/audit/verify (GET) - valid chain after events', async () => {
    // Manually insert some logs
    const auditService = app.get(AuditLogsService); // Access via class

    // We can use the service to create logs to ensure the chain is correct
    await auditService.createLog(tenantId, 'EVENT_1', { data: 1 });
    await auditService.createLog(tenantId, 'EVENT_2', { data: 2 });

    return request(app.getHttpServer())
      .get('/audit/verify')
      .set('x-api-key', apiKey)
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('/audit/verify (GET) - broken chain', async () => {
    // 1. Create a valid log

    const auditService = app.get(AuditLogsService);
    await auditService.createLog(tenantId, 'EVENT_3', { data: 3 });

    // 2. Tamper with the log in DB
    const lastLog = await prisma.auditLog.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastLog) {
      throw new Error('No log found to tamper with');
    }

    await prisma.auditLog.update({
      where: { id: lastLog.id },
      data: { payload: { data: 'TAMPERED' } }, // Hash will now match payload
    });

    return request(app.getHttpServer())
      .get('/audit/verify')
      .set('x-api-key', apiKey)
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('broken');
      });
  });
});

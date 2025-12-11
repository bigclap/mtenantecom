import { Module } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AUDIT_LOG_REPOSITORY } from './domain/audit-log.repository.interface';
import { AuditLogPrismaRepository } from './adapters/prisma/audit-log.repository';
import { AuditController } from './gateway/audit.controller';
import { TenantAuthGuard } from '../../infrastructure/auth/tenant-auth.guard';
import { TenantApiKeysModule } from '../tenant-api-keys/tenant-api-keys.module';

@Module({
  imports: [PrismaModule, TenantApiKeysModule],
  controllers: [AuditController],
  providers: [
    AuditLogsService,
    {
      provide: AUDIT_LOG_REPOSITORY,
      useClass: AuditLogPrismaRepository,
    },
    TenantAuthGuard, // Usually global or provided by AuthModule, but here we use it.
  ],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}

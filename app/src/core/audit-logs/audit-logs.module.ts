import { Module } from '@nestjs/common';
import { AuditLogsService } from './domain/audit-logs.service';
import { AuditLogsController } from './gateway/audit-logs.controller';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuditLogsController],
  providers: [AuditLogsService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}

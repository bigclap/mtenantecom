import { Module } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { ReturnsController } from './returns.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { BullModule } from '@nestjs/bullmq';
import { ReturnsProcessor } from './returns.processor';

@Module({
  imports: [
    PrismaModule,
    AuditLogsModule,
    BullModule.registerQueue({
      name: 'returns',
    }),
  ],
  controllers: [ReturnsController],
  providers: [ReturnsService, AuditLogsService, ReturnsProcessor],
})
export class ReturnsModule {}

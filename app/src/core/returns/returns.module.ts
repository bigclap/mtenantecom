import { Module } from '@nestjs/common';
import { ReturnsService } from './domain/returns.service';
import { ReturnsController } from './gateway/returns.controller';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { ReturnsProcessor } from './domain/returns.processor';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    PrismaModule,
    AuditLogsModule,
    BullModule.registerQueue({
      name: 'returns.process',
    }),
  ],
  controllers: [ReturnsController],
  providers: [ReturnsService, ReturnsProcessor],
})
export class ReturnsModule {}

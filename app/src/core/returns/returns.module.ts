import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReturnController } from './gateway/return.controller';
import { ReturnService } from './domain/return.service';
import { ReturnQueueService } from './adapters/bull/return-queue.service';
import { ReturnProcessor } from './adapters/bull/return.processor';
import { ReturnPrismaRepository } from './adapters/prisma/return.repository';
import { IReturnRepository } from './domain/return.repository.interface';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { OrderPrismaModule } from '../orders/adapters/prisma/order-prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    PrismaModule,
    AuditLogsModule,
    OrderPrismaModule,
    BullModule.registerQueue({
      name: 'returns',
    }),
  ],
  controllers: [ReturnController],
  providers: [
    ReturnService,
    ReturnQueueService,
    ReturnProcessor,
    {
      provide: IReturnRepository,
      useClass: ReturnPrismaRepository,
    },
  ],
  exports: [ReturnService],
})
export class ReturnsModule {}

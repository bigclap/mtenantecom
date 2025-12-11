import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { OrderQueueService } from './adapters/bull/order-queue.service';
import { OrderPrismaModule } from './adapters/prisma/order-prisma.module';
import { OrderService } from './domain/order.service';
import { OrderController } from './gateway/order.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    OrderPrismaModule,
    AuditLogsModule,
    BullModule.registerQueue({
      name: 'orders',
    }),
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderQueueService],
  exports: [OrderService],
})
export class OrdersModule {}

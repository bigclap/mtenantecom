import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrderController } from './gateway/order.controller';
import { OrderService } from './domain/order.service';
import { OrderPrismaModule } from './adapters/prisma/order-prisma.module';
import { OrderQueueService } from './adapters/bull/order-queue.service';

@Module({
  imports: [
    OrderPrismaModule,
    BullModule.registerQueue({
      name: 'orders',
    }),
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderQueueService],
  exports: [OrderService],
})
export class OrdersModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../infrastructure/prisma/prisma.module';
import { OrderPrismaRepository } from './order.repository';
import { IOrderRepository } from '../../domain/order.repository.interface';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: IOrderRepository,
      useClass: OrderPrismaRepository,
    },
  ],
  exports: [IOrderRepository],
})
export class OrderPrismaModule {}

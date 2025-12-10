import { Module } from '@nestjs/common';
import { OrdersService } from './domain/orders.service';
import { OrdersController } from './gateway/orders.controller';
import { OrdersShipmentController } from './gateway/orders-shipment.controller';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [OrdersController, OrdersShipmentController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

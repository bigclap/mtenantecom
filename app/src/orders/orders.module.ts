import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [OrdersController],
  providers: [OrdersService, AuditLogsService],
})
export class OrdersModule {}

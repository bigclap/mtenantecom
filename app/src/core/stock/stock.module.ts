import { Module } from '@nestjs/common';
import { StockController } from './gateway/stock.controller';
import { StockService } from './domain/stock.service';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}

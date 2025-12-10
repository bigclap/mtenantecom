import { Module } from '@nestjs/common';
import { StockController } from './gateway/stock.controller';
import { StockService } from './domain/stock.service';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { IStockRepository } from './domain/stock.repository.interface';
import { StockPrismaRepository } from './adapters/prisma/stock.repository';

@Module({
  imports: [PrismaModule],
  controllers: [StockController],
  providers: [
    StockService,
    {
      provide: IStockRepository,
      useClass: StockPrismaRepository,
    },
  ],
  exports: [StockService],
})
export class StockModule {}

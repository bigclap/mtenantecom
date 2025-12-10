import { Module } from '@nestjs/common';
import { StockController } from './gateway/stock.controller';

@Module({
  controllers: [StockController],
  providers: [],
})
export class StockModule {}

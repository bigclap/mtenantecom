import { Module } from '@nestjs/common';
import { StockLevelsService } from './stock-levels.service';
import { StockLevelsController } from './stock-levels.controller';

@Module({
  providers: [StockLevelsService],
  controllers: [StockLevelsController]
})
export class StockLevelsModule {}

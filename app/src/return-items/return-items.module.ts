import { Module } from '@nestjs/common';
import { ReturnItemsService } from './return-items.service';
import { ReturnItemsController } from './return-items.controller';

@Module({
  providers: [ReturnItemsService],
  controllers: [ReturnItemsController]
})
export class ReturnItemsModule {}

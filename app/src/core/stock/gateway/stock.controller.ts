import { Controller, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('stock')
@Controller('stock')
export class StockController {
  @Patch()
  @ApiOperation({ summary: 'Update stock level' })
  update(/* @Body() _updateStockDto: UpdateStockDto */) {
    return { status: 'updated' };
  }
}

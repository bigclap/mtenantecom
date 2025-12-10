import { Controller, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UpdateStockDto } from './dto/update-stock.dto';

@ApiTags('stock')
@Controller('stock')
export class StockController {
  @Patch()
  @ApiOperation({ summary: 'Update stock level' })
  async update(@Body() updateStockDto: UpdateStockDto) {
    return { status: 'updated' };
  }
}

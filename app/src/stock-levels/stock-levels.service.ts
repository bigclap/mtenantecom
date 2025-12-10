import { Injectable } from '@nestjs/common';

@Injectable()
export class StockLevelsService {
  checkAvailability(tenantId: string, sku: string, requestedQty: number) {
     return { available: 0, hasStock: false };
  }
}

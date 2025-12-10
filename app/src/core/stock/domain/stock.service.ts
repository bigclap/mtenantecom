import { Inject, Injectable } from '@nestjs/common';
import { IStockRepository } from './stock.repository.interface';

export interface StockCheckItem {
  sku: string;
  qty: number;
}

export interface StockAvailabilityError {
  sku: string;
  requested: number;
  available: number;
}

@Injectable()
export class StockService {
  constructor(
    @Inject(IStockRepository)
    private readonly stockRepository: IStockRepository,
  ) {}

  /**
   * Checks if there is enough stock for the given items.
   * Returns a list of items with insufficient stock.
   */
  async checkStockAvailability(
    tenantId: string,
    items: StockCheckItem[],
  ): Promise<StockAvailabilityError[]> {
    const errors: StockAvailabilityError[] = [];
    
    const skus = items.map(i => i.sku);
    const stockLevels = await this.stockRepository.findBySkus(tenantId, skus);
    const stockMap = new Map(stockLevels.map(s => [s.sku, s]));

    for (const item of items) {
      const stock = stockMap.get(item.sku);
      const available = stock ? stock.available : 0;

      if (available < item.qty) {
        errors.push({
          sku: item.sku,
          requested: item.qty,
          available,
        });
      }
    }

    return errors;
  }

  /**
   * Reserves stock for items using Optimistic Concurrency Control.
   * Decrements 'available' and increments 'reserved'.
   */
  async reserveStock(tenantId: string, items: StockCheckItem[]): Promise<void> {
    for (const item of items) {
      let retries = 5;
      let success = false;

      while (retries > 0) {
        const stock = await this.stockRepository.findBySku(tenantId, item.sku);
        
        const available = stock ? stock.available : 0;
        const currentVersion = stock ? stock.version : 0;

        if (available < item.qty) {
             throw new Error(`Insufficient stock for SKU ${item.sku}. Requested: ${item.qty}, Available: ${available}`);
        }

        if (!stock) {
             throw new Error(`Stock record missing for SKU ${item.sku}`);
        }

        const updated = await this.stockRepository.updateStock(
            tenantId, 
            item.sku, 
            currentVersion, 
            {
                availableDelta: -item.qty,
                reservedDelta: item.qty
            }
        );

        if (updated) {
            success = true;
            break;
        }

        retries--;
        // Backoff could be added here
      }

      if (!success) {
        throw new Error(`Concurrency conflict for SKU ${item.sku} after retries`);
      }
    }
  }
}
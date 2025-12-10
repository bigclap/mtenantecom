import { StockLevel } from './stock.entity';

export interface IStockRepository {
  findBySku(tenantId: string, sku: string): Promise<StockLevel | null>;
  findBySkus(tenantId: string, skus: string[]): Promise<StockLevel[]>;

  /**
   * Updates stock level using optimistic concurrency control.
   * Returns true if update was successful (version matched), false otherwise.
   */
  updateStock(
    tenantId: string,
    sku: string,
    currentVersion: number,
    update: {
      availableDelta: number;
      reservedDelta: number;
    },
  ): Promise<boolean>;

  create(
    tenantId: string,
    sku: string,
    initialAvailable: number,
  ): Promise<StockLevel>;
}

export const IStockRepository = Symbol('IStockRepository');

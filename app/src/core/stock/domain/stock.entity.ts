export class StockLevel {
  id: string;
  sku: string;
  tenantId: string;
  available: number;
  reserved: number;
  version: number;
  updatedAt: Date;
}

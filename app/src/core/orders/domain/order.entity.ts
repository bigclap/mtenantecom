export enum OrderStatus {
  PENDING = 'PENDING',
  SHIPPED = 'SHIPPED',
  CANCELLED = 'CANCELLED',
}

export class OrderItem {
  id: string;
  sku: string;
  qty: number;
}

export class Order {
  id: string;
  tenantId: string;
  externalId: string;
  status: OrderStatus;
  customer: Record<string, any>;
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

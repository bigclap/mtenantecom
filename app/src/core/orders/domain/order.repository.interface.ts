import { Order } from './order.entity';

export interface CreateOrderTxParams {
  tenantId: string;
  externalId: string;
  customer: any;
  items: { sku: string; qty: number }[];
}

export interface IOrderRepository {
  findByExternalId(tenantId: string, externalId: string): Promise<Order | null>;
  findById(tenantId: string, id: string): Promise<Order | null>;
  create(params: CreateOrderTxParams, tx?: any): Promise<Order>;
  updateStatus(tenantId: string, orderId: string, status: string, tx?: any): Promise<Order>;
}

export const IOrderRepository = Symbol('IOrderRepository');

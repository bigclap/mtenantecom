import { Return, ReturnItem } from '@prisma/client';

export type ReturnWithItems = Return & { items: ReturnItem[] };

export interface CreateReturnParams {
  tenantId: string;
  orderId: string;
  items: {
    sku: string;
    qty: number;
    reason?: string;
    orderItemId: string; // resolved from SKU
  }[];
}

export interface IReturnRepository {
  createReturn(params: CreateReturnParams): Promise<ReturnWithItems>;
  findById(tenantId: string, returnId: string): Promise<ReturnWithItems | null>;
  findByOrderId(tenantId: string, orderId: string): Promise<ReturnWithItems[]>;
  updateStatus(
    tenantId: string,
    returnId: string,
    status: 'APPROVED' | 'FAILED',
  ): Promise<ReturnWithItems>;
  approveReturn(
    tenantId: string,
    returnId: string,
    items: { sku: string; qty: number }[],
  ): Promise<void>;
}

export const IReturnRepository = Symbol('IReturnRepository');

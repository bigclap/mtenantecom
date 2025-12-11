import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  IOrderRepository,
  CreateOrderTxParams,
} from '../../domain/order.repository.interface';
import { Order, OrderStatus } from '../../domain/order.entity';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrderPrismaRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByExternalId(
    tenantId: string,
    externalId: string,
  ): Promise<Order | null> {
    const order = await this.prisma.order.findUnique({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId,
        },
      },
      include: { items: true },
    });

    if (!order) return null;

    return {
      ...order,
      customer: order.customer as Record<string, any>,
      status: order.status as OrderStatus,
      items: order.items.map((i) => ({
        id: i.id,
        sku: i.sku,
        qty: i.qty,
      })),
    };
  }

  async findById(tenantId: string, id: string): Promise<Order | null> {
    const order = await this.prisma.order.findUnique({
      where: {
        id,
      },
      include: { items: true },
    });

    if (!order || order.tenantId !== tenantId) return null;

    return {
      ...order,
      customer: order.customer as Record<string, any>,
      status: order.status as OrderStatus,
      items: order.items.map((i) => ({
        id: i.id,
        sku: i.sku,
        qty: i.qty,
      })),
    };
  }

  async create(params: CreateOrderTxParams, externalTx?: Prisma.TransactionClient): Promise<Order> {
    const { tenantId, items } = params;

    const executeLogic = async (tx: Prisma.TransactionClient) => {
      // 1. Stock Check & Reservation (Logic moved from StockService)
      const skus = items.map((i) => i.sku);
      const stockLevels = await tx.stockLevel.findMany({
        where: { tenantId, sku: { in: skus } },
      });
      const stockMap = new Map(stockLevels.map((s) => [s.sku, s]));

      const stockErrors = [];

      // Validation Phase
      for (const item of items) {
        const stock = stockMap.get(item.sku);
        const available = stock ? stock.available : 0;
        if (available < item.qty) {
          stockErrors.push({
            sku: item.sku,
            requested: item.qty,
            available,
          });
        }
      }

      if (stockErrors.length > 0) {
        throw new UnprocessableEntityException({
          error: 'INSUFFICIENT_STOCK',
          details: stockErrors,
        });
      }

      // Update Phase (Optimistic Concurrency)
      for (const item of items) {
        const stock = stockMap.get(item.sku);
        if (item.qty > 0) {
          const { count } = await tx.stockLevel.updateMany({
            where: {
              id: stock!.id,
              version: stock!.version,
              available: { gte: item.qty },
            },
            data: {
              available: { decrement: item.qty },
              reserved: { increment: item.qty },
              version: { increment: 1 },
            },
          });

          if (count === 0) {
            throw new Error(`Concurrency conflict for SKU ${item.sku}`);
          }
        }
      }

      // 2. Create Order
      const order = await tx.order.create({
        data: {
          tenantId: params.tenantId,
          externalId: params.externalId,
          customer: params.customer as Prisma.InputJsonValue,
          status: 'PENDING',
          items: {
            create: params.items.map((i) => ({
              tenantId: params.tenantId,
              sku: i.sku,
              qty: i.qty,
            })),
          },
        },
        include: { items: true },
      });

      return {
        ...order,
        customer: order.customer as Record<string, any>,
        status: order.status as OrderStatus,
        items: order.items.map((i) => ({
          id: i.id,
          sku: i.sku,
          qty: i.qty,
        })),
      };
    };

    if (externalTx) {
        return executeLogic(externalTx);
    }
    
    return this.prisma.$transaction(executeLogic);
  }

  async updateStatus(tenantId: string, orderId: string, status: OrderStatus, externalTx?: Prisma.TransactionClient): Promise<Order> {
    const executeLogic = async (tx: Prisma.TransactionClient) => {
        return tx.order.update({
            where: { id: orderId },
            data: { status },
            include: { items: true },
        });
    };
    
    if (externalTx) {
        const order = await executeLogic(externalTx);
         return {
            ...order,
            customer: order.customer as Record<string, any>,
            status: order.status as OrderStatus,
            items: order.items.map((i) => ({
                id: i.id,
                sku: i.sku,
                qty: i.qty,
            })),
        };
    }
    
    const order = await this.prisma.order.update({
        where: { id: orderId },
        data: { status },
        include: { items: true },
    });
    
    return {
        ...order,
        customer: order.customer as Record<string, any>,
        status: order.status as OrderStatus,
        items: order.items.map((i) => ({
            id: i.id,
            sku: i.sku,
            qty: i.qty,
        })),
    };
  }
}
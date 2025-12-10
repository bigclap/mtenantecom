import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { Prisma } from '@prisma/client';

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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks if there is enough stock for the given items.
   * Returns a list of items with insufficient stock.
   */
  async checkStockAvailability(
    tenantId: string,
    items: StockCheckItem[],
    tx?: Prisma.TransactionClient,
  ): Promise<StockAvailabilityError[]> {
    const prisma = tx || this.prisma;
    const errors: StockAvailabilityError[] = [];

    // Optimize: fetch all needed SKUs in one query
    const skus = items.map((i) => i.sku);
    const stockLevels = await prisma.stockLevel.findMany({
      where: {
        tenantId,
        sku: { in: skus },
      },
    });

    const stockMap = new Map(stockLevels.map((s) => [s.sku, s]));

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
   * Decreases stock for items.
   * Assumes validation passed. Use Optimistic Concurrency Control via version if needed,
   * but for simple decrement atomic update is often enough: available = available - qty.
   * However, ARCH requires using 'version' field.
   */
  async decreaseStock(
    tenantId: string,
    items: StockCheckItem[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    for (const item of items) {
      // Optimistic concurrency loop
      // We need to read, check version, and update.
      // Since we are inside a transaction (likely), we might lock or loop.
      // ARCH says: "UPDATE ... WHERE version = :read_version"

      // Since we need to read first:
      const stock = await tx.stockLevel.findUnique({
        where: { tenantId_sku: { tenantId, sku: item.sku } },
      });

      if (!stock) {
        throw new Error(`Stock not found for SKU ${item.sku}`);
      }

      const { count } = await tx.stockLevel.updateMany({
        where: {
          id: stock.id,
          version: stock.version,
          available: { gte: item.qty }, // Double check constraint
        },
        data: {
          available: { decrement: item.qty },
          reserved: { increment: item.qty }, // Usually "Create Order" reserves stock, "Ship" removes from reserved?
          // Task says "Update Stock + Audit" on Create.
          // Task "Ship" says "Корректировка резервов (снятие резерва)".
          // So Create -> Reserve.
          // available = physical - reserved?
          // Usually: Available = OnHand - Reserved.
          // If we decrement Available, we might increment Reserved.
          // "available" in DB usually means "Available for sale".
          // So: available -= qty, reserved += qty.
          version: { increment: 1 },
        },
      });

      if (count === 0) {
        throw new Error(
          `Stock update failed (optimistic lock or insufficient) for SKU ${item.sku}`,
        );
      }
    }
  }
}

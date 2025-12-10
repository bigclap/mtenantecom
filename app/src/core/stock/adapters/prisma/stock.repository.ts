import { Injectable } from '@nestjs/common';
import { IStockRepository } from '../../domain/stock.repository.interface';
import { StockLevel } from '../../domain/stock.entity';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

@Injectable()
export class StockPrismaRepository implements IStockRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySku(tenantId: string, sku: string): Promise<StockLevel | null> {
    return this.prisma.stockLevel.findUnique({
      where: { tenantId_sku: { tenantId, sku } },
    });
  }

  async findBySkus(tenantId: string, skus: string[]): Promise<StockLevel[]> {
    return this.prisma.stockLevel.findMany({
      where: { 
        tenantId,
        sku: { in: skus }
      },
    });
  }

  async create(tenantId: string, sku: string, initialAvailable: number): Promise<StockLevel> {
      return this.prisma.stockLevel.create({
          data: {
              tenantId,
              sku,
              available: initialAvailable,
              version: 1
          }
      })
  }

  async updateStock(
    tenantId: string,
    sku: string,
    currentVersion: number,
    update: { availableDelta: number; reservedDelta: number }
  ): Promise<boolean> {
    const { count } = await this.prisma.stockLevel.updateMany({
      where: {
        tenantId,
        sku,
        version: currentVersion,
      },
      data: {
        available: { increment: update.availableDelta },
        reserved: { increment: update.reservedDelta },
        version: { increment: 1 },
      },
    });

    return count > 0;
  }
}

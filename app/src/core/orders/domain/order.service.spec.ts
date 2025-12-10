/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { OrderRepository } from '../adapters/prisma/order.repository';
import { StockService } from '../../stock/domain/stock.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { CreateOrderDto } from '../gateway/dto/create-order.dto';

describe('OrderService', () => {
  let service: OrderService;
  let stockService: StockService;

  const mockPrismaService: any = {
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    order: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    orderItem: {
      createMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    orderItems: {
      findMany: jest.fn(),
    },
  };

  const mockStockService = {
    checkStockAvailability: jest.fn(),
    decreaseStock: jest.fn(),
  };

  const mockOrderRepository = {}; // We might bypass repo for this task or use it. Let's assume we use PrismaService directly for transaction control as Repository pattern + Transaction is tricky without passing TX.

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StockService, useValue: mockStockService },
        { provide: OrderRepository, useValue: mockOrderRepository }, // Kept for DI
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    stockService = module.get<StockService>(StockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    const tenantId = 'tenant-1';
    const dto: CreateOrderDto = {
      externalId: 'ext-1',
      customer: { name: 'John Doe' },
      items: [{ sku: 'SKU-1', qty: 2 }],
    };

    it('should create order successfully if stock is available', async () => {
      mockStockService.checkStockAvailability.mockResolvedValue([]);
      mockPrismaService.order.findUnique.mockResolvedValue(null);
      mockPrismaService.order.create.mockResolvedValue({
        id: 'order-1',
        ...dto,
      });

      const result = await service.createOrder(tenantId, dto);

      expect(stockService.checkStockAvailability).toHaveBeenCalledWith(
        tenantId,
        dto.items,
        expect.anything(),
      );
      expect(stockService.decreaseStock).toHaveBeenCalled();
      expect(mockPrismaService.order.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw UnprocessableEntityException if stock is insufficient', async () => {
      mockStockService.checkStockAvailability.mockResolvedValue([
        { sku: 'SKU-1', requested: 2, available: 1 },
      ]);

      await expect(service.createOrder(tenantId, dto)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(stockService.decreaseStock).not.toHaveBeenCalled();
    });

    it('should return existing order if duplicate externalId and same content', async () => {
      const existingOrder = {
        id: 'order-1',
        externalId: 'ext-1',
        items: [{ sku: 'SKU-1', qty: 2 }],
        customer: { name: 'John Doe' },
      };

      // We need to return the order WITH items to compare
      mockPrismaService.order.findUnique.mockResolvedValue(existingOrder);

      const result = await service.createOrder(tenantId, dto);

      expect(result).toEqual(existingOrder);
      expect(stockService.decreaseStock).not.toHaveBeenCalled();
      expect(mockPrismaService.order.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if duplicate externalId but different content', async () => {
      const existingOrder = {
        id: 'order-1',
        externalId: 'ext-1',
        items: [{ sku: 'SKU-1', qty: 5 }], // Different QTY
        customer: { name: 'John Doe' },
      };

      mockPrismaService.order.findUnique.mockResolvedValue(existingOrder);

      await expect(service.createOrder(tenantId, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});

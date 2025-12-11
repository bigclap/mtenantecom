/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateOrderDto } from '../gateway/dto/create-order.dto';
import { Order, OrderStatus } from './order.entity';
import { IOrderRepository } from './order.repository.interface';
import { OrderService } from './order.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { StockService } from '../../stock/domain/stock.service';
import { MetricsService } from '../../../infrastructure/metrics/metrics.service';

describe('OrderService', () => {
  let service: OrderService;
  let repository: jest.Mocked<IOrderRepository>;
  let stockService: jest.Mocked<StockService>;
  let metricsService: jest.Mocked<MetricsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: IOrderRepository,
          useValue: {
            findByExternalId: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: AuditLogsService,
          useValue: {
            createLog: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((cb) =>
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
              cb({ stockLevel: { updateMany: jest.fn() } }),
            ),
          },
        },
        {
          provide: StockService,
          useValue: {
            checkStockAvailability: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            ordersCreatedTotal: { inc: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    repository = module.get(IOrderRepository);
    stockService = module.get(StockService);
    metricsService = module.get(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder', () => {
    const tenantId = 'tenant-1';
    const dto: CreateOrderDto = {
      externalId: 'ext-1',
      customer: { name: 'John Doe' },
      items: [{ sku: 'SKU-1', qty: 2 }],
    };

    it('should create order successfully if it does not exist', async () => {
      repository.findByExternalId.mockResolvedValue(null);

      const createdOrder: Order = {
        id: 'order-1',
        tenantId,
        externalId: dto.externalId,
        status: OrderStatus.PENDING,
        customer: dto.customer,
        items: [{ id: 'item-1', sku: 'SKU-1', qty: 2 }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.create.mockResolvedValue(createdOrder);

      const result = await service.createOrder(tenantId, dto);

      expect(repository.findByExternalId).toHaveBeenCalledWith(
        tenantId,
        dto.externalId,
      );
      expect(stockService.checkStockAvailability).toHaveBeenCalledWith(
        tenantId,
        dto.items,
      );
      // Repository create is called inside transaction
      expect(repository.create).toHaveBeenCalled();
      expect(metricsService.ordersCreatedTotal.inc).toHaveBeenCalled();
      expect(result).toEqual(createdOrder);
    });

    it('should return the existing order if duplicate externalId and same content', async () => {
      const existingOrder: Order = {
        id: 'order-1',
        tenantId,
        externalId: 'ext-1',
        status: OrderStatus.PENDING,
        customer: { name: 'John Doe' },
        items: [{ id: 'item-1', sku: 'SKU-1', qty: 2 }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.findByExternalId.mockResolvedValue(existingOrder);

      const result = await service.createOrder(tenantId, dto);

      expect(result).toEqual(existingOrder);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if duplicate externalId but different content (qty)', async () => {
      const existingOrder: Order = {
        id: 'order-1',
        tenantId,
        externalId: 'ext-1',
        status: OrderStatus.PENDING,
        customer: { name: 'John Doe' },
        items: [{ id: 'item-1', sku: 'SKU-1', qty: 5 }], // Different Qty
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.findByExternalId.mockResolvedValue(existingOrder);

      await expect(service.createOrder(tenantId, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if duplicate externalId but different content (customer)', async () => {
      const existingOrder: Order = {
        id: 'order-1',
        tenantId,
        externalId: 'ext-1',
        status: OrderStatus.PENDING,
        customer: { name: 'Jane Doe' }, // Different Customer
        items: [{ id: 'item-1', sku: 'SKU-1', qty: 2 }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.findByExternalId.mockResolvedValue(existingOrder);

      await expect(service.createOrder(tenantId, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});

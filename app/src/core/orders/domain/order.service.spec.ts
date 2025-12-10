import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateOrderDto } from '../gateway/dto/create-order.dto';
import { Order, OrderStatus } from './order.entity';
import { IOrderRepository } from './order.repository.interface';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;
  let repository: jest.Mocked<IOrderRepository>;

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
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    repository = module.get(IOrderRepository);
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

      expect(repository.findByExternalId.bind(repository)).toHaveBeenCalledWith(
        tenantId,
        dto.externalId,
      );
      expect(repository.create.bind(repository)).toHaveBeenCalledWith({
        tenantId,
        externalId: dto.externalId,
        customer: dto.customer,
        items: dto.items,
      });
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
      expect(repository.create.bind(repository)).not.toHaveBeenCalled();
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
      expect(repository.create.bind(repository)).not.toHaveBeenCalled();
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

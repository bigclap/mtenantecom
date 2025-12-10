import { Test, TestingModule } from '@nestjs/testing';
import { IStockRepository } from './stock.repository.interface';
import { StockService } from './stock.service';

describe('StockService', () => {
  let service: StockService;
  let repository: jest.Mocked<IStockRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        {
          provide: IStockRepository,
          useValue: {
            findBySku: jest.fn(),
            findBySkus: jest.fn(),
            updateStock: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
    repository = module.get(IStockRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkStockAvailability', () => {
    it('should return errors for insufficient stock', async () => {
      repository.findBySkus.mockResolvedValueOnce([
        {
          id: '1',
          tenantId: 'tenant1',
          sku: 'SKU1',
          available: 5,
          reserved: 0,
          version: 1,
          updatedAt: new Date(),
        },
      ]);

      const result = await service.checkStockAvailability('tenant1', [
        { sku: 'SKU1', qty: 10 },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].sku).toBe('SKU1');
      expect(result[0].available).toBe(5);
    });

    it('should treat missing stock record as 0 available', async () => {
      repository.findBySkus.mockResolvedValueOnce([]);

      const result = await service.checkStockAvailability('tenant1', [
        { sku: 'SKU2', qty: 1 },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].available).toBe(0);
    });

    it('should return empty array if stock is sufficient', async () => {
      repository.findBySkus.mockResolvedValueOnce([
        {
          id: '1',
          tenantId: 'tenant1',
          sku: 'SKU1',
          available: 10,
          reserved: 0,
          version: 1,
          updatedAt: new Date(),
        },
      ]);

      const result = await service.checkStockAvailability('tenant1', [
        { sku: 'SKU1', qty: 5 },
      ]);

      expect(result).toEqual([]);
    });
  });

  describe('reserveStock', () => {
    it('should reserve stock successfully', async () => {
      repository.findBySku.mockResolvedValue({
        id: '1',
        tenantId: 'tenant1',
        sku: 'SKU1',
        available: 10,
        reserved: 0,
        version: 1,
        updatedAt: new Date(),
      });
      repository.updateStock.mockResolvedValue(true);

      await expect(
        service.reserveStock('tenant1', [{ sku: 'SKU1', qty: 5 }]),
      ).resolves.not.toThrow();

      expect(repository.updateStock.bind(repository)).toHaveBeenCalledWith(
        'tenant1',
        'SKU1',
        1,
        { availableDelta: -5, reservedDelta: 5 },
      );
    });

    it('should throw error if insufficient stock', async () => {
      repository.findBySku.mockResolvedValue({
        id: '1',
        tenantId: 'tenant1',
        sku: 'SKU1',
        available: 2,
        reserved: 0,
        version: 1,
        updatedAt: new Date(),
      });

      await expect(
        service.reserveStock('tenant1', [{ sku: 'SKU1', qty: 5 }]),
      ).rejects.toThrow('Insufficient stock');
    });

    it('should retry on optimistic lock failure', async () => {
      // First attempt: read version 1, update fails (false)
      // Second attempt: read version 2, update succeeds (true)
      repository.findBySku
        .mockResolvedValueOnce({
          id: '1',
          tenantId: 'tenant1',
          sku: 'SKU1',
          available: 10,
          reserved: 0,
          version: 1,
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: '1',
          tenantId: 'tenant1',
          sku: 'SKU1',
          available: 10,
          reserved: 0,
          version: 2,
          updatedAt: new Date(),
        });

      repository.updateStock
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await expect(
        service.reserveStock('tenant1', [{ sku: 'SKU1', qty: 5 }]),
      ).resolves.not.toThrow();

      expect(repository.updateStock.bind(repository)).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      repository.findBySku.mockResolvedValue({
        id: '1',
        tenantId: 'tenant1',
        sku: 'SKU1',
        available: 10,
        reserved: 0,
        version: 1,
        updatedAt: new Date(),
      });
      repository.updateStock.mockResolvedValue(false); // Always fail

      await expect(
        service.reserveStock('tenant1', [{ sku: 'SKU1', qty: 5 }]),
      ).rejects.toThrow('Concurrency conflict');

      expect(repository.updateStock).toHaveBeenCalled();
    });
  });
});

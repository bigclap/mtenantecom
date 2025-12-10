import { Test, TestingModule } from '@nestjs/testing';
import { ReturnService } from './return.service';
import { IReturnRepository } from './return.repository.interface';
import { IOrderRepository } from '../../orders/domain/order.repository.interface';
import { ReturnQueueService } from '../adapters/bull/return-queue.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import {
  UnprocessableEntityException,
  NotFoundException,
} from '@nestjs/common';

const mockReturnRepository = {
  createReturn: jest.fn(),
  findByOrderId: jest.fn(),
  findById: jest.fn(),
  updateStatus: jest.fn(),
};

const mockOrderRepository = {
  findById: jest.fn(),
};

const mockReturnQueueService = {
  addReturnJob: jest.fn(),
};

const mockAuditLogsService = {
  createLog: jest.fn(),
};

describe('ReturnService', () => {
  let service: ReturnService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnService,
        { provide: IReturnRepository, useValue: mockReturnRepository },
        { provide: IOrderRepository, useValue: mockOrderRepository },
        { provide: ReturnQueueService, useValue: mockReturnQueueService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
      ],
    }).compile();

    service = module.get<ReturnService>(ReturnService);
    jest.clearAllMocks();
  });

  it('should create a return request successfully', async () => {
    const tenantId = 'tenant-1';
    const orderId = 'order-1';
    const items = [{ sku: 'SKU1', qty: 1 }];
    const order = {
      id: orderId,
      tenantId,
      items: [{ id: 'item-1', sku: 'SKU1', qty: 5 }],
    };

    mockOrderRepository.findById.mockResolvedValue(order);
    mockReturnRepository.findByOrderId.mockResolvedValue([]); // No previous returns
    mockReturnRepository.createReturn.mockResolvedValue({
      id: 'return-1',
      status: 'PENDING',
    });

    const result = await service.createReturnRequest(tenantId, {
      orderId,
      items,
    });

    expect(result).toBeDefined();
    expect(mockOrderRepository.findById).toHaveBeenCalledWith(
      tenantId,
      orderId,
    );
    expect(mockReturnRepository.createReturn).toHaveBeenCalled();
    expect(mockAuditLogsService.createLog).toHaveBeenCalledWith(
      tenantId,
      'RETURN_REQUESTED',
      expect.any(Object),
    );
    expect(mockReturnQueueService.addReturnJob).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, returnId: 'return-1' }),
    );
  });

  it('should throw NotFoundException if order not found', async () => {
    mockOrderRepository.findById.mockResolvedValue(null);
    await expect(
      service.createReturnRequest('t1', { orderId: 'o1', items: [] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw UnprocessableEntityException if returning more than purchased', async () => {
    const tenantId = 'tenant-1';
    const orderId = 'order-1';
    const order = {
      id: orderId,
      tenantId,
      items: [{ id: 'item-1', sku: 'SKU1', qty: 1 }],
    };

    mockOrderRepository.findById.mockResolvedValue(order);
    mockReturnRepository.findByOrderId.mockResolvedValue([]); // No previous returns

    // Requesting 2, purchased 1
    await expect(
      service.createReturnRequest(tenantId, {
        orderId,
        items: [{ sku: 'SKU1', qty: 2 }],
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('should throw UnprocessableEntityException if total returned (prev + curr) > purchased', async () => {
    const tenantId = 'tenant-1';
    const orderId = 'order-1';
    const order = {
      id: orderId,
      tenantId,
      items: [{ id: 'item-1', sku: 'SKU1', qty: 5 }],
    };

    // Previous return: 4 items returned (Wait, mock implementation details needed)
    // Return entity logic usually involves loading relations.
    // Simplified mock: returns have items
    const prevReturn = {
      id: 'prev-1',
      items: [{ orderItemId: 'item-1', qty: 4 }],
    };

    mockOrderRepository.findById.mockResolvedValue(order);
    // We need to implement logic in Service to map OrderItem ID back to SKU or vice versa when checking previous returns
    // Assuming service handles this mapping.
    // For this test, we need to ensure service can map 'item-1' back to SKU1 or just use qty.
    mockReturnRepository.findByOrderId.mockResolvedValue([prevReturn]);

    // Requesting 2 more (4 + 2 = 6 > 5)
    await expect(
      service.createReturnRequest(tenantId, {
        orderId,
        items: [{ sku: 'SKU1', qty: 2 }],
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});

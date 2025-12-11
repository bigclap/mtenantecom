import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IReturnRepository } from './return.repository.interface';
import { IOrderRepository } from '../../orders/domain/order.repository.interface';
import { ReturnQueueService } from '../adapters/bull/return-queue.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { CreateReturnDto } from '../gateway/dto/create-return.dto';

@Injectable()
export class ReturnService {
  constructor(
    @Inject(IReturnRepository)
    private readonly returnRepository: IReturnRepository,
    @Inject(IOrderRepository)
    private readonly orderRepository: IOrderRepository,
    private readonly returnQueueService: ReturnQueueService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async createReturnRequest(tenantId: string, dto: CreateReturnDto) {
    // 1. Fetch Order
    const order = await this.orderRepository.findById(tenantId, dto.orderId);
    if (!order) {
      throw new NotFoundException(`Order ${dto.orderId} not found`);
    }

    // 2. Fetch previous returns to calculate remaining qty
    // This returns existing 'Return' entities. We need to fetch their items too.
    // Assuming IReturnRepository.findByOrderId returns returns with items.
    const previousReturns = await this.returnRepository.findByOrderId(
      tenantId,
      dto.orderId,
    );

    // Calculate total returned per Order Item ID
    const returnedMap = new Map<string, number>(); // orderItemId -> totalReturnedQty

    for (const ret of previousReturns) {
      // We assume 'ret.items' is available via IReturnRepository interface
      if (ret.items) {
        for (const item of ret.items) {
          const current = returnedMap.get(item.orderItemId) || 0;
          returnedMap.set(item.orderItemId, current + item.qty);
        }
      }
    }

    // 3. Validate Request
    const returnItemsToCreate = [];

    for (const reqItem of dto.items) {
      // Find order item by SKU
      const orderItem = order.items.find((i) => i.sku === reqItem.sku);
      if (!orderItem) {
        throw new UnprocessableEntityException(
          `SKU ${reqItem.sku} not found in order`,
        );
      }

      const previouslyReturned = returnedMap.get(orderItem.id) || 0;
      const remaining = orderItem.qty - previouslyReturned;

      if (reqItem.qty > remaining) {
        throw new UnprocessableEntityException(
          `Cannot return ${reqItem.qty} of SKU ${reqItem.sku}. Purchased: ${orderItem.qty}, Already Returned: ${previouslyReturned}`,
        );
      }

      returnItemsToCreate.push({
        sku: reqItem.sku,
        qty: reqItem.qty,
        reason: reqItem.reason,
        orderItemId: orderItem.id,
      });
    }

    // 4. Create Return Record (PENDING)
    const returnRecord = await this.returnRepository.createReturn({
      tenantId,
      orderId: dto.orderId,
      items: returnItemsToCreate,
    });

    // 5. Audit Log
    await this.auditLogsService.createLog(tenantId, 'RETURN_REQUESTED', {
      returnId: returnRecord.id,
      orderId: dto.orderId,
      items: dto.items,
    });

    // 6. Enqueue Job
    // Important: Pass tenantId context
    await this.returnQueueService.addReturnJob({
      tenantId,
      returnId: returnRecord.id,
      traceId: 'todo-trace-id', // Should grab from CLS
    });

    return returnRecord;
  }

  async processReturn(tenantId: string, returnId: string) {
    // 1. Fetch Return
    const returnRequest = await this.returnRepository.findById(
      tenantId,
      returnId,
    );
    if (!returnRequest) {
      throw new NotFoundException(`Return ${returnId} not found`);
    }

    if (returnRequest.status !== 'PENDING') {
      return; // Already processed
    }

    // 2. Fetch Order to map IDs to SKUs
    const order = await this.orderRepository.findById(
      tenantId,
      returnRequest.orderId,
    );
    if (!order) {
      throw new UnprocessableEntityException('Order not found for return');
    }

    const itemsToRestock = [];
    for (const retItem of returnRequest.items) {
      const orderItem = order.items.find((i) => i.id === retItem.orderItemId);
      if (orderItem) {
        itemsToRestock.push({ sku: orderItem.sku, qty: retItem.qty });
      }
    }

    // 3. Approve & Restock (Transaction)
    await this.returnRepository.approveReturn(
      tenantId,
      returnId,
      itemsToRestock,
    );

    // 4. Audit Log
    await this.auditLogsService.createLog(tenantId, 'RETURN_APPROVED', {
      returnId,
      itemsRestocked: itemsToRestock,
    });
  }

  async markAsFailed(tenantId: string, returnId: string, error?: string) {
    const returnRequest = await this.returnRepository.findById(
      tenantId,
      returnId,
    );

    if (!returnRequest || returnRequest.status !== 'PENDING') {
      return;
    }

    await this.returnRepository.updateStatus(tenantId, returnId, 'FAILED');

    await this.auditLogsService.createLog(tenantId, 'RETURN_FAILED', {
      returnId,
      error,
    });
  }
}

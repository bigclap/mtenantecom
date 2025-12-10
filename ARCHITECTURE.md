# Architecture Design Document

## Modules

The application is modularized using NestJS modules, aligned with the domain entities:

*   **Tenants Module**: Manages tenant information.
*   **TenantApiKeys Module**: Manages API keys for tenant authentication.
*   **Orders Module**: Handles order creation, status updates, and retrieval.
*   **OrderItems Module**: Manages items within an order (mostly internal use).
*   **StockLevels Module**: Manages inventory availability and reservations.
*   **Returns Module**: Handles return requests and their lifecycle.
*   **ReturnItems Module**: Manages items within a return.
*   **WebhookEvents Module**: Handles incoming webhooks and ensures idempotency.
*   **AuditLogs Module**: Records system events in a tamper-evident hash chain.
*   **Prisma Module**: Global module for database access.
*   **BullModule**: Configured in AppModule for background job processing (Returns).

## Flows

### 1. Order Creation
1.  **Endpoint**: `POST /api/tenants/:tenantId/orders`
2.  **Auth**: Validates `X-API-Key` matches the `tenantId`.
3.  **Validation**: Checks payload (customer, items).
4.  **Stock Check**: Queries `StockLevel` for all items. If insufficient `available`, throws 422.
5.  **Transaction**:
    *   Creates `Order` and `OrderItems`.
    *   Updates `StockLevel`: decrements `available`, increments `reserved`.
    *   Creates `AuditLog` entry (`ORDER_CREATED`).
6.  **Idempotency**: Uses `externalId` + `tenantId` constraint. Existing order with same hash returns 200; different hash returns 409.

### 2. Order Shipment
1.  **Endpoint**: `POST /api/tenants/:tenantId/orders/:orderId/ship`
2.  **Auth**: Tenant validation.
3.  **Transaction**:
    *   Verifies status is `PENDING`.
    *   Updates status to `SHIPPED`.
    *   Updates `StockLevel`: decrements `reserved` (permanently removing stock).
    *   Creates `AuditLog` entry (`ORDER_SHIPPED`).

### 3. Returns (Async)
1.  **Endpoint**: `POST /api/tenants/:tenantId/returns`
2.  **Validation**: Checks `qty` against original order items.
3.  **Action**:
    *   Creates `Return` (PENDING) and `ReturnItems`.
    *   Creates `AuditLog` (`RETURN_REQUESTED`).
    *   Adds job to `returns` queue (BullMQ).
4.  **Worker**:
    *   Processes job.
    *   Updates `Return` status to `APPROVED`.
    *   Updates `StockLevel`: increments `available` (restocking).
    *   Creates `AuditLog` (`RETURN_APPROVED`).
    *   Handles retries/failures.

### 4. Webhooks
1.  **Endpoint**: `POST /api/webhooks/shop/order-updated`
2.  **Auth**: Finds tenant by `tenantExternalId`. Verifies HMAC signature.
3.  **Idempotency**: Checks/Creates `WebhookEvent`. If exists, returns 200.
4.  **Processing**: Triggers logic to sync order/stock and log `ORDER_SYNCED_FROM_WEBHOOK`.

## Multi-tenant Strategy
*   **Row-Level Isolation**: Every table has `tenant_id`.
*   **Middleware Enforcement**: Middleware extracts tenant from API Key, validates it against the URL `tenantId`, and injects it into the request context (or AsyncLocalStorage).
*   **Prisma Middleware/Extensions** (Optional but recommended): Can be used to auto-filter queries by `tenant_id`, though explicit filtering is used here for clarity and control.

## Transactions & Idempotency
*   **Transactions**: All multi-step write operations (Order Create, Ship, Return Approve) run inside `prisma.$transaction`.
*   **Idempotency**:
    *   Orders: Unique constraint on `(tenantId, externalId)`.
    *   Webhooks: Unique constraint on `(tenantId, eventId)`.

## Audit Log
*   **Hash Chain**: Each new log entry calculates `SHA256(prev_hash + current_data)`.
*   **Verification**: An endpoint re-calculates the chain to detect tampering.

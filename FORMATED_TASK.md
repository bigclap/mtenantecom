# Детализация задач по доменам (Domain Breakdown)

Легенда:
*   **[ТЗ]** — Явное требование из исходного задания (`TASK.md`).
*   **[ARCH]** — Архитектурное решение или уточнение, необходимое для качественной реализации (из `ARCHITECTURE.md`).

## 1. Domain: Identity Access (Tenants)
**Ответственность:** Идентификация и авторизация магазинов.

### Сущности
*   `Tenant`: `id`, `name`.
*   `TenantApiKey`: `key`, `secret`, `tenantId`, `externalId` (для вебхуков).

### Функционал
1.  **Auth Middleware / Guard**
    *   **[ТЗ]** Валидация `X-API-Key` в заголовках.
    *   **[ТЗ]** Сопоставление ключа с `tenant_id`.
    *   **[ТЗ]** Проверка соответствия `tenantId` в URL и в ключе.
    *   **[ARCH]** Проброс `tenantId` и `traceId` в Request Context (через `nest-cls`). **Важно:** При работе с очередями (BullMQ) контекст разрывается, поэтому его необходимо явно передавать в payload задачи и восстанавливать (обертывать в CLS) внутри воркера.

2.  **API Keys Management**
    *   **[ТЗ]** Хранение ключей с привязкой к `tenant_id`.
    *   **[ТЗ]** Поддержка `external_id` (для идентификации тенанта во входящем вебхуке).

## 2. Domain: Order Processing (Orders)
**Ответственность:** Управление жизненным циклом заказа.

### Сущности
*   `Order`: `id`, `externalId`, `tenantId`, `status` (PENDING, SHIPPED, CANCELLED), `customer` (JSON).
*   `OrderItem`: `sku`, `qty`.

### Функционал
1.  **Создание заказа (POST /orders)**
    *   **[ТЗ]** Синхронная обработка (клиент ждет ответ).
    *   **[ТЗ]** Валидация DTO (qty > 0).
    *   **[ТЗ]** Проверка стоков. Если не хватает — вернуть **422 Unprocessable Entity** с телом:
        ```json
        { "error": "INSUFFICIENT_STOCK", "details": [{ "sku": "...", "requested": 10, "available": 5 }] }
        ```
    *   **[ТЗ]** Идемпотентность по `externalId`:
        *   Если дубль (тот же ID и контент) — вернуть существующий заказ (200 OK).
        *   Если ID тот же, но контент разный — вернуть **409 Conflict**.
    *   **[ТЗ]** Транзакционное создание Order + OrderItems + Update Stock + Audit.
    *   **[ARCH]** Использование TDD при реализации.

2.  **Отгрузка заказа (POST /ship)**
    *   **[ТЗ]** Смена статуса `PENDING` -> `SHIPPED`.
    *   **[ТЗ]** Корректировка резервов (снятие резерва).
    *   **[ТЗ]** Запись события `ORDER_SHIPPED` в аудит.
    *   **[ТЗ]** Если статус неверный (например, Cancelled) — вернуть **409 Conflict**.

## 3. Domain: Inventory (Stock)
**Ответственность:** Точный учет остатков.

### Сущности
*   `StockLevel`: `sku`, `tenantId`, `available`, `reserved`, `version`.

### Функционал
1.  **Управление резервами**
    *   **[ТЗ]** Учет `available` и `reserved`.
    *   **[ТЗ]** Если нет записи StockLevel — считаем, что стока 0.
    *   **[ARCH]** **Optimistic Concurrency Control**: Использовать поле `version` для защиты от гонок при обновлении.
    *   **[ARCH]** Атомарные апдейты в БД (`UPDATE ... SET available = available - X ...`).

## 4. Domain: Reverse Logistics (Returns)
**Ответственность:** Обработка возвратов (асинхронно).

### Сущности
*   `Return`: `status` (PENDING, APPROVED, FAILED).
*   `ReturnItem`: `qty`, `reason`.

### Функционал
1.  **Запрос возврата (POST /returns)**
    *   **[ТЗ]** Валидация: нельзя вернуть больше, чем было куплено.
    *   **[ТЗ]** Создание записи `PENDING` + `RETURN_REQUESTED` в аудит.
    *   **[ТЗ]** Отправка задачи в очередь `BullMQ` (producer).

2.  **Процессинг возврата (Worker)**
    *   **[ТЗ]** Обработка в фоне.
    *   **[ТЗ]** Транзакция: Status -> `APPROVED`, Stock.Available += Qty, Audit -> `RETURN_APPROVED`.
    *   **[ТЗ]** Retry policy: повтор при временных ошибках.
    *   **[ТЗ]** Dead Letter Logic: после N (например, 5) попыток — статус `FAILED`.
    *   **[ARCH]** Явная передача контекста (`tenantId`) в payload задачи для корректной работы внутри воркера.

## 5. Domain: Integration Gateway (Webhooks)
**Ответственность:** Адаптация внешних событий.

### Сущности
*   `WebhookEvent`: `tenantId`, `eventId`, `payload`, `created_at`.

### Функционал
1.  **Прием вебхука (POST /webhooks/shop/...)**
    *   **[ТЗ]** Поиск тенанта по `tenantExternalId` (через `tenant_api_keys`).
    *   **[ТЗ]** Валидация подписи HMAC SHA256. Ошибка — 401/403.
    *   **[ТЗ]** Идемпотентность: сохранение в `webhook_events` (Unique Index: `tenantId` + `eventId`). Если дубль — 200 OK.
    *   **[ARCH]** **Adapter Pattern**: Маппинг внешнего JSON во внутреннюю команду (например, `UpsertOrder`).
    *   **[ТЗ]** Запись в аудит события `ORDER_SYNCED_FROM_WEBHOOK`.

## 6. Domain: Audit Compliance (Audit)
**Ответственность:** Неизменяемый лог действий.

### Сущности
*   `AuditLog`: `eventType`, `payload`, `hash`, `prevHash`.

### Функционал
1.  **Запись события**
    *   **[ТЗ]** Расчет Hash = `SHA256(PrevHash + Data)`.
    *   **[ТЗ]** Строгая последовательность для каждого тенанта.
    *   **[ARCH]** **Pessimistic Locking**: `SELECT ... FOR UPDATE` последней записи аудита для предотвращения ветвления цепочки.

2.  **Верификация (GET /audit/verify)**
    *   **[ТЗ]** Проход по цепочке и пересчет хешей.
    *   **[ТЗ]** Ответ: `{"status": "ok"}` или `{"status": "broken", ...}`.

## 7. Infrastructure DevOps

### Компоненты
1.  **Database**
    *   **[ТЗ]** PostgreSQL + Docker Compose.
    *   **[ТЗ]** Prisma Schema + Migrations.
    *   **[ARCH]** Использование нативных типов (`UUID`, `VARCHAR`).

2.  **Observability**
    *   **[ТЗ]** Логирование HTTP запросов (method, duration, status, tenant_id).
    *   **[ТЗ]** Метрики `/metrics` (JSON):
        *   `orders_created_total`
        *   `webhook_errors_total`
        *   `returns_failed_total`
        *   `returns_queue_size`

3.  **Documentation**
    *   **[ТЗ]** `ARCHITECTURE.md`.
    *   **[ARCH]** Swagger (OpenAPI) для API.

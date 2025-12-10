Тестовое задание — Backend Core / Architect
Node.js / TypeScript / NestJS / PostgreSQL / Redis (BullMQ)
Ориентир по времени: ≈15–20 часов
1. Контекст
Нужно сделать ядро multi-tenant SaaS-сервиса для e-commerce:
 * несколько магазинов (tenants);
 * заказы, сток, возвраты;
 * приём webhooks от внешней системы (условный "shop");
 * фоновые процессы на очередях.
Цель теста — посмотреть, как ты:
 * проектируешь данные и границы модулей;
 * работаешь с транзакциями и идемпотентностью;
 * думаешь о multi-tenant, очередях, логах и минимальных метриках.
2. Стек (фиксированный)
Используй, пожалуйста, именно это:
 * Node.js 18+
 * TypeScript
 * NestJS
 * PostgreSQL
 * Prisma (ORM, schema-first)
 * Redis + BullMQ (через @nestjs/bull или прямую интеграцию)
 * Docker / docker-compose для Postgres и Redis
 * Jest для тестов (достаточно нескольких ключевых)
3. Multi-tenant стратегия (фиксируем upfront)
Используем row-level multi-tenant:
 * во всех доменных таблицах есть поле tenant_id UUID NOT NULL;
 * на tenant_id висят индексы;
 * любой запрос к доменным таблицам фильтруется по tenant_id.
RLS (Row Level Security) можешь включить, если хочешь, но не обязательно. Главное — чтобы в коде была чёткая tenant-фильтрация.
4. Что нужно сделать
4.1. ARCHITECTURE.md
Короткий design-док:
 * какие модули есть (пример: Tenant, Order, Stock, Return, Webhook, Jobs, Audit);
 * как выглядят основные потоки:
   * создание заказа,
   * отгрузка,
   * возврат,
   * приём webhook'а;
 * какие слои есть в NestJS (контроллеры / сервисы / доменная логика / доступ к данным);
 * коротко обоснуй:
   * выбранный подход к multi-tenant,
   * как работаешь с транзакциями,
   * как обеспечиваешь идемпотентность.
Не надо писать книгу, нам важна ясность, не объём.
4.2. Модель данных + миграции
Через Prisma schema + миграции.
Минимум таблиц:
 * tenants — магазины;
 * tenant_api_keys — API-ключи для магазинов (tenant_id, api_key, secret, is_active);
 * orders
 * order_items
 * stock_levels
 * returns
 * return_items
 * audit_log
 * webhook_events — для идемпотентности webhook'ов.
Требования:
 * в orders, order_items, stock_levels, returns, return_items, audit_log, webhook_events присутствует tenant_id;
 * внешние ключи и индексы на ключевые поля (tenant_id, внешние id, external_id, event_id);
 * webhook_events имеет уникальный индекс (tenant_id, event_id).
4.3. Флоу 1: создание заказа + резерв стока
Endpoint:
POST /api/tenants/:tenantId/orders
Тело:
{
  "externalId": "shop-order-123",
  "customer": { "name": "John Doe", "email": "..." },
  "items": [
    { "sku": "SKU-1", "qty": 2 },
    { "sku": "SKU-2", "qty": 1 }
  ]
}

Требования:
 * Валидация:
   * DTO + class-validator;
   * qty > 0, sku — строка и т.п.
 * Бизнес-правила:
   * если для какого-то sku нет записи stock_levels — считаем, что стока нет;
   * если хотя бы по одному SKU запрошенное количество qty > доступного (available),
   * → вернуть 422 с описанием:
   <!-- end list -->
   {
  "error": "INSUFFICIENT_STOCK",
  "details": [
    { "sku": "SKU-1", "requested": 10, "available": 5 }
  ]
}

   * частичный заказ не создаём — либо всё, либо ошибка.
 * Транзакция (Postgres):
   * создаёт order + order_items;
   * обновляет stock_levels (например: available уменьшается, reserved увеличивается);
   * пишет событие в audit_log с типом ORDER_CREATED.
 * Идемпотентность:
   * для (tenant_id, externalId) заказ должен быть уникален;
   * при повторном запросе с тем же externalId и идентичным содержимым → вернуть существующий заказ, не создавая дубликатов;
   * если содержимое отличается — можно вернуть 409 Conflict.
4.4. Флоу 2: отгрузка заказа
Endpoint:
POST /api/tenants/:tenantId/orders/:orderId/ship
Требования:
 * статус заказа до этого, например, PENDING;
 * в транзакции:
   * проверяем текущий статус;
   * переводим в SHIPPED;
   * корректируем сток (опционально: уменьшаем reserved, либо ведём отдельный учёт);
   * пишем ORDER_SHIPPED в audit_log.
При неверном статусе → 409 Conflict.
4.5. Флоу 3: возвраты (async через очередь)
Сценарий:
 * Клиент инициирует возврат.
 * Возврат создаётся синхронно.
 * Обработка (approve + корректировка стока) идёт через очередь BullMQ.
Endpoint создания возврата
POST /api/tenants/:tenantId/returns
{
  "orderId": "UUID",
  "items": [
    { "orderItemId": "UUID", "qty": 1, "reason": "damaged" }
  ]
}

Правила:
 * по каждому orderItemId суммарный qty возвратов (все returns) не может превышать qty в заказе;
 * если это нарушается — 422 с деталями;
 * создаём return (статус PENDING) + return_items;
 * отправляем задачу в очередь returns.process (BullMQ), кладя туда tenantId и returnId;
 * пишем RETURN_REQUESTED в audit_log.
Воркер возвратов
 * читает задачи из returns.process;
 * "одобряет" возврат (без сложной логики: можно считать все валидными);
 * в транзакции:
   * ставит статус APPROVED;
   * увеличивает available в stock_levels на возвращённый qty;
   * добавляет RETURN_APPROVED в audit_log.
Ретраи:
 * для временных ошибок (например, ошибка БД) настраиваем несколько попыток с backoff;
 * если задача падает N раз подряд (например, 5)
   * → помечаем возврат как FAILED и не ретраим бесконечно.
4.6. Webhooks (идемпотентность + auth)
Endpoint:
POST /api/webhooks/shop/order-updated
Тело (упрощённо):
{
  "tenantExternalId": "shop-123",
  "eventId": "evt-abc-123",
  "orderExternalId": "shop-order-123",
  "payload": {
    "...": "..."
  },
  "signature": "hmac-sha256-base64"
}

Доп. модель:
 * tenant_api_keys хранит tenant_id, external_id (наш tenantExternalId) и secret.
Требования:
 * Поиск tenant'а:
   * по tenantExternalId находится tenant через tenant_api_keys;
   * tenant должен существовать заранее, auto-create запрещён.
 * Проверка подписи:
   * signature — простой HMAC SHA256 по телу запроса и secret;
   * при неверной подписи → 401/403.
 * Идемпотентность:
   * в webhook_events сохраняем (tenant_id, event_id, payload, created_at) с уникальным индексом (tenant_id, event_id);
   * если запись уже есть — считаем событие обработанным и отвечаем 200 (idempotent).
 * Обработка:
   * после валидации и идемпотентности вызываем внутреннюю команду (например, upsertOrderFromWebhook), которая:
     * создаст/обновит заказ (orders/order_items) на основе orderExternalId + payload;
     * при необходимости обновит резервы стока;
     * добавит событие в audit_log (ORDER_SYNCED_FROM_WEBHOOK).
4.7. Простейшая безопасность / tenant-контекст
 * все /api/tenants/:tenantId/... защищены API-ключом: X-API-Key;
 * X-API-Key привязан к конкретному tenant_id (через tenant_api_keys);
 * middleware/guard:
   * находит tenant по X-API-Key,
   * проверяет, что tenantId в URL совпадает с tenant_id ключа,
   * прокидывает tenant_id в контекст запросов/сервисов.
4.8. Immutable audit (hash-цепочка)
Таблица audit_log:
 * id
 * tenant_id
 * event_type
 * payload (JSON)
 * created_at
 * prev_hash
 * hash
Правила:
 * цепочка считается per tenant (для каждого tenant_id своя последовательность);
 * при вставке события:
   * ищем последний hash для этого tenant'а;
   * считаем hash = SHA256(prev_hash + serialized_event_data)
     (можно использовать любую консистентную сериализацию JSON);
   * сохраняем prev_hash и hash.
Endpoint:
GET /api/tenants/:tenantId/audit/verify
 * проходит по событиям этого tenant'а в порядке создания;
 * пересчитывает hash-цепочку;
 * возвращает:
   * {"status": "ok"}
   * или {"status": "broken", "atId": "...", "reason": "..."}.
Если хочешь, можешь кратко описать в ARCHITECTURE.md, как ты сериализуешь записи и как избегаешь гонок (например, через сортировку по created_at или id).
4.9. Логи и метрики
Логи:
 * middleware, логирующий:
   * метод, путь, tenant_id, статус, длительность;
 * логирование ошибок с stack trace и контекстом (без токенов, паролей и прочего мусора).
Метрики:
 * endpoint /metrics в простом формате JSON или Prometheus — на твоё усмотрение;
 * не обязательно тянуть отдельные библиотеки, можно отдать объект.
Минимум:
 * orders_created_total
 * webhook_errors_total
 * returns_failed_total
 * returns_queue_size (если есть доступ к этой информации через BullMQ).
5. Тесты (минимум)
Нужен небольшой набор тестов (Jest):
 * Идемпотентность заказа:
   * два вызова POST /orders с одинаковым externalId + содержимым
   * → один и тот же orderId.
 * Идемпотентность webhook'a:
   * два вызова webhook'а с одинаковым eventId
   * → одно событие в webhook_events и корректное состояние заказа.
 * Целостность hash-цепочки:
   * несколько событий для одного tenant'а,
   * GET /audit/verify должен вернуть status: "ok".
Больше тестов — отлично, но эти три — база.
6. Что прислать в конце
 * Ссылку на репозиторий (GitHub/GitLab) или архив .zip.
 * README.md:
   * как поднять проект (docker-compose, миграции, команды);
   * какие endpoints есть;
   * что успел сделать, что сознательно опустил.
 * ARCHITECTURE.md с описанием модулей, флоу и ключевых решений.
 * (Опционально) короткое видео 5–10 минут, где:
   * показываешь архитектуру,
   * проходишь по основным флоу и решениям.

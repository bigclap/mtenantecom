Architecture Design Document
1. Обзор архитектуры (High-Level Overview)
Проект спроектирован по принципам Clean / Hexagonal Architecture.
Цель — изолировать бизнес-ядро (Core Domain) от внешних интерфейсов и инфраструктуры.
Структура модулей
src/
├── core/                        # Bounded Contexts
│   ├── orders/
│   │   ├── domain/              # PURE BUSINESS LOGIC
│   │   │   ├── order.entity.ts  # Доменная модель
│   │   │   └── order.service.ts # Use Cases
│   │   │
│   │   ├── gateway/             # PRIMARY ADAPTERS (Вход)
│   │   │   ├── dto/             # DTO с валидацией
│   │   │   └── order.controller.ts
│   │   │
│   │   └── adapters/            # SECONDARY ADAPTERS (Выход)
│   │       ├── prisma/          # Работа с БД
│   │       │   ├── order.repository.ts
│   │       │   └── order-prisma.module.ts
│   │       └── bull/            # Очереди (для асинхронных задач)
│   │           └── order-queue.service.ts
│   ├── stock/
│   └── tenants/
│
├── integrations/                # ACL для внешних систем
│   ├── shop-basic/              # Адаптер для Shop API
│   └── (future) shopify/
│
└── infrastructure/              # Глобальные модули
    ├── prisma/
    ├── redis/                   # Redis config
    └── swagger/                 # Code-First Swagger setup

2. Ключевые архитектурные решения
2.1. Методология
 * TDD: Тесты первичны.
 * Синхронность vs Асинхронность:
   * Создание заказа (Critical Path): Синхронно (Transaction), чтобы клиент сразу получал результат (OK/422).
   * Возвраты (Background): Асинхронно через BullMQ, так как процесс длительный и требует подтверждений.
2.2. Multi-tenancy
Row-Level Multi-tenancy.
 * tenantId (UUID) во всех таблицах.
 * @@index([tenantId]) обязателен.
 * Изоляция на уровне Middleware (Context).
2.3. Работа с данными (PostgreSQL 18 + Prisma)
 * Native Types: Использование @db.Uuid и VARCHAR вместо TEXT.
 * Prisma: Только как ORM в слое адаптеров.
2.4. Конкурентность (Concurrency Control)
Проблема: Race Conditions (Stock & Audit)
Мы не используем очередь для создания заказа из-за требований синхронного ответа API. Вместо этого применяем:
 * Stock (Остатки):
   * Optimistic Locking: Поле version в StockLevel.
   * Atomic Updates: UPDATE stock SET available = available - :qty WHERE sku = :sku AND available >= :qty.
   * Это гарантирует, что мы не продадим воздух, без жестких блокировок всей таблицы.
 * Audit Log (Hash Chain):
   * Pessimistic Locking (FOR UPDATE): Блокировка последней записи аудита внутри транзакции.
   * Гарантирует строгую последовательность хешей.
 * Idempotency (Webhooks):
   * Уникальный индекс (tenantId, eventId) в БД.
3. Стек технологий
 * Runtime: Node.js 20+ (LTS)
 * Framework: NestJS
 * Database: PostgreSQL 18
 * ORM: Prisma
 * Queue: Redis + BullMQ (стандарт де-факто для NestJS)
 * Docs: Swagger (Code-First)
 * Testing: Jest
4. Ограничения
 * Валюта: Только учет количества (qty), без денег.
 * Масштабирование: Текущая реализация Audit Log через БД подходит для нагрузок SMB. Для Enterprise требуется переход на Append-Only Logs (Kafka/NATS), что выходит за рамки тестового.

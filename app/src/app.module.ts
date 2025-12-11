import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { ClsModule } from 'nestjs-cls';
import { AuditLogsModule } from './core/audit-logs/audit-logs.module';
import { OrdersModule } from './core/orders/orders.module';
import { ReturnsModule } from './core/returns/returns.module';
import { StockModule } from './core/stock/stock.module';
import { TenantApiKeysModule } from './core/tenant-api-keys/tenant-api-keys.module';
import { TenantsModule } from './core/tenants/tenants.module';
import { WebhookEventsModule } from './core/webhook-events/webhook-events.module';
import { HttpLoggingMiddleware } from './infrastructure/logging/http-logging.middleware';
import { MetricsModule } from './infrastructure/metrics/metrics.module';
import { AuditLoggerMiddleware } from './infrastructure/middleware/audit-logger.middleware';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { ShopBasicModule } from './integrations/shop-basic/shop-basic.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        POSTGRES_USER: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_DB: Joi.string().required(),
        POSTGRES_HOST: Joi.string().required(),
        POSTGRES_PORT: Joi.number().required(),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        NGINX_PORT: Joi.number().optional(),
      }),
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    PrismaModule,
    RedisModule,
    MetricsModule,
    OrdersModule,
    StockModule,
    TenantsModule,
    ReturnsModule,
    AuditLogsModule,
    WebhookEventsModule,
    TenantApiKeysModule,
    ShopBasicModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggingMiddleware).forRoutes('*');
    consumer.apply(AuditLoggerMiddleware).forRoutes('*');
  }
}

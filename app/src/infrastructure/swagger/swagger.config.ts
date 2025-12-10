import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Inventory Management API')
    .setDescription('API for managing orders, stock, and tenants')
    .setVersion('1.0')
    .addTag('orders')
    .addTag('stock')
    .addTag('tenants')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
}

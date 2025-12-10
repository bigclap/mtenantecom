import { Module } from '@nestjs/common';
import { TenantController } from './gateway/tenant.controller';

@Module({
  controllers: [TenantController],
  providers: [],
})
export class TenantsModule {}

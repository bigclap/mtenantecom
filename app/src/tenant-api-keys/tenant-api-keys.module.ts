import { Module } from '@nestjs/common';
import { TenantApiKeysService } from './tenant-api-keys.service';
import { TenantApiKeysController } from './tenant-api-keys.controller';

@Module({
  providers: [TenantApiKeysService],
  controllers: [TenantApiKeysController]
})
export class TenantApiKeysModule {}

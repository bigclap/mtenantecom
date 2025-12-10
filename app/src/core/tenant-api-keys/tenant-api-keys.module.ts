import { Global, Module } from '@nestjs/common';
import { TenantApiKeysService } from './tenant-api-keys.service';

@Global()
@Module({
  imports: [],
  providers: [TenantApiKeysService],
  exports: [TenantApiKeysService],
})
export class TenantApiKeysModule {}

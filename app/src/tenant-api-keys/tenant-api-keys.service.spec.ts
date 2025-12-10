import { Test, TestingModule } from '@nestjs/testing';
import { TenantApiKeysService } from './tenant-api-keys.service';

describe('TenantApiKeysService', () => {
  let service: TenantApiKeysService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantApiKeysService],
    }).compile();

    service = module.get<TenantApiKeysService>(TenantApiKeysService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

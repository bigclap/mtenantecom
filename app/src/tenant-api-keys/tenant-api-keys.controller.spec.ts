import { Test, TestingModule } from '@nestjs/testing';
import { TenantApiKeysController } from './tenant-api-keys.controller';

describe('TenantApiKeysController', () => {
  let controller: TenantApiKeysController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantApiKeysController],
    }).compile();

    controller = module.get<TenantApiKeysController>(TenantApiKeysController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

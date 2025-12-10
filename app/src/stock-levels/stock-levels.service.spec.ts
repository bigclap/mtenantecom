import { Test, TestingModule } from '@nestjs/testing';
import { StockLevelsService } from './stock-levels.service';

describe('StockLevelsService', () => {
  let service: StockLevelsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StockLevelsService],
    }).compile();

    service = module.get<StockLevelsService>(StockLevelsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

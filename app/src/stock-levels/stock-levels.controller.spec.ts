import { Test, TestingModule } from '@nestjs/testing';
import { StockLevelsController } from './stock-levels.controller';

describe('StockLevelsController', () => {
  let controller: StockLevelsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockLevelsController],
    }).compile();

    controller = module.get<StockLevelsController>(StockLevelsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

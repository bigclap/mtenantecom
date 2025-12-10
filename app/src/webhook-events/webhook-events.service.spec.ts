import { Test, TestingModule } from '@nestjs/testing';
import { WebhookEventsService } from './webhook-events.service';

describe('WebhookEventsService', () => {
  let service: WebhookEventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebhookEventsService],
    }).compile();

    service = module.get<WebhookEventsService>(WebhookEventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

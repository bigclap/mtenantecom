import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsService } from './audit-logs.service';
import { AUDIT_LOG_REPOSITORY } from './domain/audit-log.repository.interface';
import { AuditLog } from './domain/audit-log.entity';
import * as crypto from 'crypto';

describe('AuditLogsService', () => {
  let service: AuditLogsService;

  const mockRepository = {
    create: jest.fn(),
    findByTenantId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        {
          provide: AUDIT_LOG_REPOSITORY,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);

    jest.clearAllMocks();
  });

  const stableStringify = (obj: any): string => {
    if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
    const typedObj = obj as Record<string, any>;
    const keys = Object.keys(typedObj).sort();
    const parts: string[] = keys.map(
      (key) => JSON.stringify(key) + ':' + stableStringify(typedObj[key]),
    );
    return '{' + parts.join(',') + '}';
  };

  const hashFn = (prev: string, data: any) => {
    return crypto
      .createHash('sha256')
      .update(prev + stableStringify(data))
      .digest('hex');
  };

  describe('verifyChain', () => {
    it('should return ok for empty chain', async () => {
      mockRepository.findByTenantId.mockResolvedValue([]);
      const result = await service.verifyChain('tenant-1');
      expect(result).toEqual({ status: 'ok' });
    });

    it('should return ok for valid chain', async () => {
      const log1Data = { eventType: 'A', payload: { x: 1 } };
      const hash1 = hashFn('0'.repeat(64), log1Data);
      const log1 = new AuditLog(
        '1',
        't1',
        'A',
        { x: 1 },
        hash1,
        null,
        new Date(),
      );

      const log2Data = { eventType: 'B', payload: { y: 2 } };
      const hash2 = hashFn(hash1, log2Data);
      const log2 = new AuditLog(
        '2',
        't1',
        'B',
        { y: 2 },
        hash2,
        hash1,
        new Date(),
      );

      mockRepository.findByTenantId.mockResolvedValue([log1, log2]);

      const result = await service.verifyChain('t1');
      expect(result).toEqual({ status: 'ok' });
    });

    it('should return broken if hash mismatch', async () => {
      const hash1 = hashFn('0'.repeat(64), { eventType: 'A', payload: {} });
      const log1 = new AuditLog('1', 't1', 'A', {}, hash1, null, new Date());

      // Log 2: claims prevHash is hash1, but its own hash is wrong.
      const log2 = new AuditLog(
        '2',
        't1',
        'B',
        {},
        'WRONG_HASH',
        hash1,
        new Date(),
      );

      mockRepository.findByTenantId.mockResolvedValue([log1, log2]);

      const result = await service.verifyChain('t1');
      expect(result).toEqual({ status: 'broken', brokenAt: '2' });
    });

    it('should return broken if chain link broken (prevHash mismatch)', async () => {
      const hash1 = hashFn('0'.repeat(64), { eventType: 'A', payload: {} });
      const log1 = new AuditLog('1', 't1', 'A', {}, hash1, null, new Date());

      const hash2 = hashFn('SOME_OTHER_HASH', { eventType: 'B', payload: {} });
      // log2 says its prevHash is SOME_OTHER_HASH, but we expect it to be hash1
      const log2 = new AuditLog(
        '2',
        't1',
        'B',
        {},
        hash2,
        'SOME_OTHER_HASH',
        new Date(),
      );

      mockRepository.findByTenantId.mockResolvedValue([log1, log2]);

      const result = await service.verifyChain('t1');
      expect(result).toEqual({ status: 'broken', brokenAt: '2' });
    });
  });
});

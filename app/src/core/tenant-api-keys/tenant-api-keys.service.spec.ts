import { Test, TestingModule } from '@nestjs/testing';
import { TenantApiKeysService } from './tenant-api-keys.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

describe('TenantApiKeysService', () => {
  let service: TenantApiKeysService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantApiKeysService,
        {
          provide: PrismaService,
          useValue: {
            tenantApiKey: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<TenantApiKeysService>(TenantApiKeysService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateKey', () => {
    it('should return tenantApiKey if found and active', async () => {
      const mockKey = 'valid-key';
      const mockResult = {
        id: '1',
        key: mockKey,
        tenantId: 'tenant-1',
        isActive: true,
      };

      (prismaService.tenantApiKey.findUnique as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const result = await service.validateKey(mockKey);
      expect(result).toEqual(mockResult);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.tenantApiKey.findUnique).toHaveBeenCalledWith({
        where: { key: mockKey },
      });
    });

    it('should return null if key not found', async () => {
      const mockKey = 'invalid-key';
      (prismaService.tenantApiKey.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await service.validateKey(mockKey);
      expect(result).toBeNull();
    });

    it('should return null if key is inactive', async () => {
      const mockKey = 'inactive-key';
      const mockResult = {
        id: '1',
        key: mockKey,
        tenantId: 'tenant-1',
        isActive: false,
      };

      (prismaService.tenantApiKey.findUnique as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const result = await service.validateKey(mockKey);
      expect(result).toBeNull();
    });
  });
});

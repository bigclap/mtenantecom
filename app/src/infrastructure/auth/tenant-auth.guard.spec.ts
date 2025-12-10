import { Test, TestingModule } from '@nestjs/testing';
import { TenantAuthGuard } from './tenant-auth.guard';
import { TenantApiKeysService } from '../../core/tenant-api-keys/tenant-api-keys.service';
import { ClsService } from 'nestjs-cls';
import {
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';

describe('TenantAuthGuard', () => {
  let guard: TenantAuthGuard;
  let tenantApiKeysService: TenantApiKeysService;
  let clsService: ClsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantAuthGuard,
        {
          provide: TenantApiKeysService,
          useValue: {
            validateKey: jest.fn(),
          },
        },
        {
          provide: ClsService,
          useValue: {
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<TenantAuthGuard>(TenantAuthGuard);
    tenantApiKeysService =
      module.get<TenantApiKeysService>(TenantApiKeysService);
    clsService = module.get<ClsService>(ClsService);
  });

  const createMockContext = (
    headers: Record<string, string | string[] | undefined>,
    params: Record<string, string> = {},
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          params,
        }),
      }),
    }) as unknown as ExecutionContext;

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should throw UnauthorizedException if X-API-Key is missing', async () => {
    const context = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException if API key is invalid', async () => {
    const context = createMockContext({ 'x-api-key': 'invalid' });
    (tenantApiKeysService.validateKey as jest.Mock).mockResolvedValue(null);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should set CLS context and return true if API key is valid', async () => {
    const context = createMockContext({ 'x-api-key': 'valid' });
    const mockApiKey = { tenantId: 'tenant-1' };
    (tenantApiKeysService.validateKey as jest.Mock).mockResolvedValue(
      mockApiKey,
    );

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(clsService.set).toHaveBeenCalledWith('tenantId', 'tenant-1');
  });

  it('should throw ForbiddenException if tenantId param does not match', async () => {
    const context = createMockContext(
      { 'x-api-key': 'valid' },
      { tenantId: 'tenant-2' },
    );
    const mockApiKey = { tenantId: 'tenant-1' };
    (tenantApiKeysService.validateKey as jest.Mock).mockResolvedValue(
      mockApiKey,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });
  it('should allow if tenantId param matches', async () => {
    const context = createMockContext(
      { 'x-api-key': 'valid' },
      { tenantId: 'tenant-1' },
    );
    const mockApiKey = { tenantId: 'tenant-1' };
    (tenantApiKeysService.validateKey as jest.Mock).mockResolvedValue(
      mockApiKey,
    );

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { TenantApiKeysService } from '../../core/tenant-api-keys/tenant-api-keys.service';

@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(
    private readonly tenantApiKeysService: TenantApiKeysService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKeyHeader = request.headers['x-api-key'];

    if (!apiKeyHeader) {
      throw new UnauthorizedException('X-API-Key header is missing');
    }

    const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;

    const tenantApiKey = await this.tenantApiKeysService.validateKey(apiKey);

    if (!tenantApiKey) {
      throw new UnauthorizedException('Invalid API Key');
    }

    const { tenantId } = tenantApiKey;
    const paramTenantId = request.params.tenantId;

    if (paramTenantId && paramTenantId !== tenantId) {
      throw new ForbiddenException('Tenant ID mismatch');
    }

    this.cls.set('tenantId', tenantId);

    return true;
  }
}

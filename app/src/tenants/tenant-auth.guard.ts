import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const tenantIdParam = request.params.tenantId;

    if (!apiKey) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    if (!tenantIdParam) {
       // If the route doesn't have tenantId param, we might just validate the key.
       // But task says "all /api/tenants/:tenantId/... protected"
       // We will assume this guard is used on those routes.
       return false;
    }

    const keyRecord = await this.prisma.tenantApiKey.findUnique({
      where: { key: apiKey as string },
      include: { tenant: true },
    });

    if (!keyRecord || !keyRecord.isActive) {
      throw new UnauthorizedException('Invalid or inactive API Key');
    }

    if (keyRecord.tenantId !== tenantIdParam) {
      throw new UnauthorizedException('API Key does not match the requested Tenant ID');
    }

    // Attach tenant to request object for easier access
    request.tenant = keyRecord.tenant;

    return true;
  }
}

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const tenantIdParam = request.params.tenantId;

    if (!apiKey) {
      throw new UnauthorizedException('API Key is missing');
    }

    const keyRecord = await this.prisma.tenantApiKey.findUnique({
      where: { key: apiKey },
    });

    if (!keyRecord || !keyRecord.isActive) {
      throw new ForbiddenException('Invalid or inactive API Key');
    }

    if (tenantIdParam && keyRecord.tenantId !== tenantIdParam) {
       throw new ForbiddenException('API Key does not belong to the requested tenant');
    }

    // Set tenant context
    this.cls.set('tenantId', keyRecord.tenantId);

    return true;
  }
}

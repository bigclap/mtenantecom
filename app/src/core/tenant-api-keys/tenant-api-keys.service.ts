import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { TenantApiKey } from '@prisma/client';

@Injectable()
export class TenantApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async validateKey(key: string): Promise<TenantApiKey | null> {
    const apiKey = await this.prisma.tenantApiKey.findUnique({
      where: { key },
    });

    if (!apiKey || !apiKey.isActive) {
      return null;
    }

    return apiKey;
  }

  async findByExternalId(externalId: string): Promise<TenantApiKey | null> {
    const apiKey = await this.prisma.tenantApiKey.findFirst({
      where: { externalId },
    });

    if (!apiKey || !apiKey.isActive) {
      return null;
    }

    return apiKey;
  }
}

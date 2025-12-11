import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { TenantApiKey } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class TenantApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async createKey(tenantId: string, externalId?: string): Promise<TenantApiKey> {
    const key = crypto.randomBytes(32).toString('hex');
    const secret = crypto.randomBytes(32).toString('hex');
    
    return this.prisma.tenantApiKey.create({
      data: {
        tenantId,
        key,
        secret,
        externalId: externalId || null,
      },
    });
  }

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

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaPostgresAdapter } from '@prisma/adapter-ppg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');
    console.log(connectionString);
    if (connectionString) {
      const adapter = new PrismaPostgresAdapter({
        connectionString,
      });
      super({
        adapter,
      });
    } else {
      throw new Error('DATABASE_URL is not set');
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

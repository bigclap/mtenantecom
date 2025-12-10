import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { WebhookDto } from '../gateway/webhook.dto';
import * as crypto from 'crypto';
import { AuditLogsService } from '../../../core/audit-logs/domain/audit-logs.service';

@Injectable()
export class WebhookService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService
  ) {}

  async handleOrderUpdated(dto: WebhookDto) {
    const keyRecord = await this.prisma.tenantApiKey.findFirst({
        where: { externalId: dto.tenantExternalId },
        include: { tenant: true }
    });

    if (!keyRecord) {
        throw new UnauthorizedException('Tenant not found');
    }

    const existingEvent = await this.prisma.webhookEvent.findUnique({
        where: {
            tenantId_eventId: {
                tenantId: keyRecord.tenantId,
                eventId: dto.eventId
            }
        }
    });

    if (existingEvent) {
        return { status: 'ok', idempotent: true };
    }

    await this.prisma.$transaction(async (tx) => {
        await tx.webhookEvent.create({
            data: {
                tenantId: keyRecord.tenantId,
                eventId: dto.eventId,
                payload: dto.payload,
            }
        });

        await this.auditLogsService.logTransaction(
            tx,
            keyRecord.tenantId,
            'ORDER_SYNCED_FROM_WEBHOOK',
            { eventId: dto.eventId, type: 'WEBHOOK_SYNC' }
        );
    });

    return { status: 'ok' };
  }
}

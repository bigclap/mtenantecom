import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class WebhookEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tries to save the webhook event.
   * Returns true if saved (new event).
   * Returns false if duplicate (idempotent).
   */
  async saveEvent(
    tenantId: string,
    eventId: string,
    payload: any,
  ): Promise<boolean> {
    try {
      await this.prisma.webhookEvent.create({
        data: {
          tenantId,
          eventId,
          payload: payload as Prisma.InputJsonValue,
        },
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Unique constraint violation -> Duplicate event
        return false;
      }
      throw error;
    }
  }
}

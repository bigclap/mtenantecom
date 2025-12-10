import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuditLogsService } from '../domain/audit-logs.service';
import { ApiKeyGuard } from '../../../infrastructure/auth/api-key.guard';

@Controller('api/tenants/:tenantId/audit')
@UseGuards(ApiKeyGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get('verify')
  async verifyChain(@Param('tenantId') tenantId: string) {
    return this.auditLogsService.verifyChain(tenantId);
  }
}

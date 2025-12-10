import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { TenantAuthGuard } from '../tenants/tenant-auth.guard';

@Controller('api/tenants/:tenantId/audit')
@UseGuards(TenantAuthGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get('verify')
  verify(@Param('tenantId') tenantId: string) {
    return this.auditLogsService.verify(tenantId);
  }
}

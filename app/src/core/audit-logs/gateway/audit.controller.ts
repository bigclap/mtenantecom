import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ClsService } from 'nestjs-cls';
import { AuditLogsService } from '../audit-logs.service';
import { TenantAuthGuard } from '../../../infrastructure/auth/tenant-auth.guard';

@ApiTags('Audit')
@Controller('audit')
export class AuditController {
  constructor(
    private readonly auditService: AuditLogsService,
    private readonly cls: ClsService,
  ) {}

  @Get('verify')
  @UseGuards(TenantAuthGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOperation({
    summary:
      'Verify the integrity of the audit log chain for the current tenant',
  })
  @ApiResponse({ status: 200, description: 'Verification result' })
  async verify() {
    const tenantId = this.cls.get<string>('tenantId');
    return this.auditService.verifyChain(tenantId);
  }
}

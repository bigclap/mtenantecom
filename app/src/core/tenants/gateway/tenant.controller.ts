import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('tenants')
@Controller('tenants')
export class TenantController {
  @Post()
  @ApiOperation({ summary: 'Create a tenant' })
  create(/* @Body() _createTenantDto: CreateTenantDto */) {
    return { status: 'created' };
  }
}

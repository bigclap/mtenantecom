import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CreateTenantDto } from './dto/create-tenant.dto';

@ApiTags('tenants')
@Controller('tenants')
export class TenantController {
  @Post()
  @ApiOperation({ summary: 'Create a tenant' })
  async create(@Body() createTenantDto: CreateTenantDto) {
    return { status: 'created' };
  }
}

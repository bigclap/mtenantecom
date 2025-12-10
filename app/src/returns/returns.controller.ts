import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { TenantAuthGuard } from '../tenants/tenant-auth.guard';

@Controller('api/tenants/:tenantId/returns')
@UseGuards(TenantAuthGuard)
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  create(@Param('tenantId') tenantId: string, @Body() createReturnDto: CreateReturnDto) {
    return this.returnsService.create(tenantId, createReturnDto);
  }
}

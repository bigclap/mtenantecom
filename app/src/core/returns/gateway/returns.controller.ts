import { Controller, Post, Body, UseGuards, Param } from '@nestjs/common';
import { ReturnsService } from '../domain/returns.service';
import { CreateReturnDto } from './create-return.dto';
import { ApiKeyGuard } from '../../../infrastructure/auth/api-key.guard';

@Controller('api/tenants/:tenantId/returns')
@UseGuards(ApiKeyGuard)
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  async createReturn(
    @Param('tenantId') tenantId: string,
    @Body() createReturnDto: CreateReturnDto,
  ) {
    return this.returnsService.createReturn(tenantId, createReturnDto);
  }
}

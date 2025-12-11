import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ReturnService } from '../domain/return.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { TenantAuthGuard } from '../../../infrastructure/auth/tenant-auth.guard';
import { ClsService } from 'nestjs-cls';

@ApiTags('Returns')
@Controller('returns')
@UseGuards(TenantAuthGuard)
@ApiHeader({ name: 'x-api-key', required: true })
export class ReturnController {
  constructor(
    private readonly returnService: ReturnService,
    private readonly cls: ClsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a return request' })
  @ApiResponse({ status: 201, description: 'Return request created' })
  async createReturn(
    @Body() dto: CreateReturnDto,
  ) {
    const tenantId = this.cls.get('tenantId');
    return this.returnService.createReturnRequest(tenantId, dto);
  }
}

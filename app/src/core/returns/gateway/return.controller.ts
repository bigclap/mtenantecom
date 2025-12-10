import {
  Body,
  Controller,
  Post,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ReturnService } from '../domain/return.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Returns')
@Controller('returns')
export class ReturnController {
  constructor(private readonly returnService: ReturnService) {}

  @Post()
  @ApiOperation({ summary: 'Create a return request' })
  @ApiResponse({ status: 201, description: 'Return request created' })
  async createReturn(
    @Headers('x-tenant-id') tenantId: string, // In real app, this comes from Guard/Interceptor via Decorator
    @Body() dto: CreateReturnDto,
  ) {
    if (!tenantId) {
      // Fallback if guard doesn't handle it or for simple test
      // Ideally use @ActiveTenant() decorator
      throw new UnauthorizedException('Tenant ID missing');
    }
    return this.returnService.createReturnRequest(tenantId, dto);
  }
}

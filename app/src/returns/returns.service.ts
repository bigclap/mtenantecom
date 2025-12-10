import { Injectable } from '@nestjs/common';
import { CreateReturnDto } from './dto/create-return.dto';

@Injectable()
export class ReturnsService {
  create(tenantId: string, createReturnDto: CreateReturnDto) {
    return 'This action adds a new return';
  }
}

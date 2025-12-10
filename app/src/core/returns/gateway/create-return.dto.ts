import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReturnItemDto {
  @IsUUID()
  @IsNotEmpty()
  orderItemId: string;

  @IsNumber()
  @Min(1)
  qty: number;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateReturnDto {
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];
}

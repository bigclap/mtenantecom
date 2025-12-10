import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class ShopOrderItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  qty: number;
}

class ShopCustomerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  email?: string;
}

export class ShopWebhookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ type: ShopCustomerDto })
  @ValidateNested()
  @Type(() => ShopCustomerDto)
  customer: ShopCustomerDto;

  @ApiProperty({ type: [ShopOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShopOrderItemDto)
  items: ShopOrderItemDto[];
}

import { IsArray, IsInt, IsNotEmpty, IsObject, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  email: string;
}

class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsInt()
  @Min(1)
  qty: number;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  externalId: string;

  @ValidateNested()
  @Type(() => CustomerDto)
  @IsObject()
  customer: CustomerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

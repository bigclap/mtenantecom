import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ShopWebhookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenantExternalId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orderExternalId: string;

  @ApiProperty()
  @IsObject()
  payload: Record<string, any>;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  signature: string;
}

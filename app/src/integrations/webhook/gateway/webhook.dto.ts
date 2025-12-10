import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class WebhookDto {
  @IsString()
  @IsNotEmpty()
  tenantExternalId: string;

  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  orderExternalId: string;

  @IsObject()
  payload: any;

  @IsString()
  @IsNotEmpty()
  signature: string;
}

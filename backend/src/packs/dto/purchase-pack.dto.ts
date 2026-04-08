import { CurrencyType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class PurchasePackDto {
  @IsOptional()
  @IsEnum(CurrencyType)
  currencyType?: CurrencyType;
}

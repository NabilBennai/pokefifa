import { IsIn, IsOptional } from 'class-validator';

export class PurchasePackDto {
  @IsOptional()
  @IsIn(['COINS', 'GEMS', 'SHARDS'])
  currencyType?: 'COINS' | 'GEMS' | 'SHARDS';
}

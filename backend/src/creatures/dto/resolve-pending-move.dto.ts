import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ResolvePendingMoveDto {
  @IsOptional()
  @IsString()
  replaceMoveId?: string;

  @IsOptional()
  @IsBoolean()
  skip?: boolean;
}

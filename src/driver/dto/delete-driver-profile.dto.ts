import { IsBoolean, IsOptional, IsString, Equals } from 'class-validator';

export class DeleteDriverProfileDto {
  @IsBoolean()
  @Equals(true)
  confirmation: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

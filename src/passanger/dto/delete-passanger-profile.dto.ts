import { IsBoolean, IsOptional, IsString, Equals } from 'class-validator';

export class DeletePassangerProfileDto {
  @IsBoolean()
  @Equals(true)
  confirmation: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

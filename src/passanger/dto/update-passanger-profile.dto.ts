import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePassangerProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  profile_image?: string;
}

import { IsOptional, IsString } from 'class-validator';

export class UpdateDriverProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  license_number?: string;

  @IsOptional()
  @IsString()
  vehicle_plate?: string;

  @IsOptional()
  @IsString()
  vehicle_model?: string;

  @IsOptional()
  @IsString()
  vehicle_year?: string;

  @IsOptional()
  @IsString()
  profile_image?: string;
}

import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDriverProfileDto {
  @IsString()
  @MinLength(2)
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  license_number: string;

  @IsString()
  @IsNotEmpty()
  vehicle_plate: string;

  @IsString()
  @IsNotEmpty()
  vehicle_model: string;

  @IsString()
  @IsNotEmpty()
  vehicle_year: string;

  @IsOptional()
  @IsString()
  profile_image?: string;
}

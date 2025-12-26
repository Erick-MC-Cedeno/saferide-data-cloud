import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsMongoId, IsEmail, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateDriverDto {
  @IsMongoId()
  @IsOptional()
  user?: string; // referencia al User (ObjectId)
  
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  phone: string;
  @IsString()
  @Transform(({ value, obj }) => value ?? obj?.license_number)
  licenseNumber: string;

  @IsOptional()
  @IsString()
  license_number?: string;

  @IsString()
  @Transform(({ value, obj }) => value ?? obj?.vehicle_plate)
  vehiclePlate: string;

  @IsString()
  @IsNotEmpty()
  vehicle_plate: string;

  @IsString()
  @Transform(({ value, obj }) => value ?? obj?.vehicle_model)
  vehicleModel: string;

  @IsString()
  @IsNotEmpty()
  vehicle_model: string;

  @IsString()
  @Transform(({ value, obj }) => value ?? obj?.vehicle_year)
  vehicleYear: string;

  @IsString()
  @IsNotEmpty()
  vehicle_year: string;

  @IsBoolean()
  @IsOptional()
  is_verified?: boolean;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(50)
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'La contraseña debe contener mayúsculas, minúsculas y números',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}

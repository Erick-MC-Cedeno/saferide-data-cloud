import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsMongoId, IsEmail, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateDriverDto {
  @IsMongoId()
  @IsOptional()
  user?: string; // referencia al User (ObjectId)

  @IsString()
  @IsNotEmpty()
  uid: string;

  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsString()
  license_number: string;

  @IsString()
  vehicle_plate: string;

  @IsString()
  vehicle_model: string;

  @IsString()
  vehicle_year: string;

  @IsBoolean()
  @IsOptional()
  is_verified?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'La contraseña debe contener mayúsculas, minúsculas y números',
  })
  password?: string;

  @IsOptional()
  @IsString()
  confirmPassword?: string;
}

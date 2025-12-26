import { IsEmail, IsNotEmpty, IsOptional, IsString, IsMongoId, MinLength, MaxLength, Matches } from 'class-validator';

export class CreatePassangerDto {
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

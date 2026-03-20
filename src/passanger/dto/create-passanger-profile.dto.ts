import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePassangerProfileDto {
  @IsString()
  @MinLength(2)
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsString()
  profile_image?: string;
}

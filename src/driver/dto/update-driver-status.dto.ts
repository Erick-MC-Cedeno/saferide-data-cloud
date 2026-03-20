import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateDriverStatusDto {
  @IsBoolean()
  @IsNotEmpty()
  isOnline: boolean;
}

import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RideStatus } from '../enums/ride-status.enum';

export class UpdateRideStatusDto {
  @IsEnum(RideStatus)
  @IsNotEmpty()
  status: RideStatus;

  @IsOptional()
  @IsString()
  cancellation_reason?: string;
}

import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ArrayMinSize } from 'class-validator';

export class CreateRideDto {
  @IsString()
  @IsNotEmpty()
  passenger_uid: string;

  @IsString()
  @IsNotEmpty()
  passenger_name: string;

  @IsString()
  @IsOptional()
  driver_uid?: string;

  @IsString()
  @IsOptional()
  driver_name?: string;

  @IsString()
  @IsNotEmpty()
  pickup_address: string;

  @IsArray()
  @ArrayMinSize(2)
  pickup_coordinates: number[];

  @IsString()
  @IsNotEmpty()
  destination_address: string;

  @IsArray()
  @ArrayMinSize(2)
  destination_coordinates: number[];

  @IsNumber()
  estimated_fare: number;

  @IsNumber()
  estimated_duration: number;

  @IsString()
  @IsOptional()
  status?: string;
}

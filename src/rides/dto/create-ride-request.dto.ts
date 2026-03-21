import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ArrayMinSize,
  ArrayMaxSize,
  Min,
} from 'class-validator';

export class CreateRideRequestDto {
  @IsString()
  @IsNotEmpty()
  pickup_address: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  pickup_coordinates: [number, number];

  @IsString()
  @IsNotEmpty()
  destination_address: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  destination_coordinates: [number, number];

  @IsNumber()
  @Min(0)
  estimated_fare: number;

  @IsNumber()
  @Min(0)
  estimated_duration: number;

  @IsOptional()
  @IsString()
  preferred_driver_id?: string;
}

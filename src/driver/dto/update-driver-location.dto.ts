import { IsArray, IsNumber, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class UpdateDriverLocationDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates: [number, number];
}

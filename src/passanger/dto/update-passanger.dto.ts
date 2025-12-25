import { PartialType } from '@nestjs/mapped-types';
import { CreatePassangerDto } from './create-passanger.dto';

export class UpdatePassangerDto extends PartialType(CreatePassangerDto) {}

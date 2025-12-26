import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PassangerService } from './passanger.service';
import { CreatePassangerDto } from './dto/create-passanger.dto';
import { UpdatePassangerDto } from './dto/update-passanger.dto';
import { AuthenticatedGuard } from '../guard/auth/authenticated.guard';

@Controller('passangers')
export class PassangerController {
  constructor(private readonly svc: PassangerService) {}

  @Post()
  async create(@Body() body: CreatePassangerDto) {
    return this.svc.create(body);
  }

  @Get()
  @UseGuards(AuthenticatedGuard)
  findAll() {
    return this.svc.findAll();
  }

  @Get(':email')
  @UseGuards(AuthenticatedGuard)
  findByEmail(@Param('email') email: string) {
    return this.svc.findByEmail(email);
  }

  @UseGuards(AuthenticatedGuard)
  @Patch(':email')
  update(@Param('email') email: string, @Body() body: UpdatePassangerDto) {
    return this.svc.updateByEmail(email, body);
  }
}

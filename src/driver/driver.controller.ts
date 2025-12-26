import { Body, Controller, Get, Param, Patch, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { DriverService } from './driver.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { AuthenticatedGuard } from '../guard/auth/authenticated.guard';

@Controller('drivers')
export class DriverController {
  constructor(private readonly svc: DriverService) {}

  @Post()
  async create(@Body() body: CreateDriverDto) {
    return this.svc.create(body);
  }

  

  @Get('online')
  @UseGuards(AuthenticatedGuard)
  online() {
    return this.svc.findAllOnline();
  }

  @Get(':email')
  @UseGuards(AuthenticatedGuard)
  findByEmail(@Param('email') email: string) {
    return this.svc.findByEmail(email);
  }

  @UseGuards(AuthenticatedGuard)
  @Patch(':email')
  update(@Param('email') email: string, @Body() body: UpdateDriverDto) {
    return this.svc.updateByEmail(email, body);
  }

  @Get()
  @UseGuards(AuthenticatedGuard)
  getAll() {
    return this.svc.findAll();
  }
}

import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { DriverService } from './driver.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { UserService } from '../user/user.service';
import { AuthenticatedGuard } from '../guard/auth/authenticated.guard';

@Controller('drivers')
export class DriverController {
  constructor(private readonly svc: DriverService, private readonly userService: UserService) {}

  @Post()
  async create(@Body() body: CreateDriverDto) {
    let user: any = null;
    if (body.password && body.confirmPassword) {
      try {
        user = await this.userService.register({
          firstName: (body.name || '').split(' ')[0] || '',
          lastName: (body.name || '').split(' ').slice(1).join(' ') || '',
          email: body.email,
          password: body.password,
          confirmPassword: body.confirmPassword,
        });
      } catch (e) {
        user = await this.userService.ensureUserByEmail(body.email, body.name, body.uid).catch(() => null);
      }
    } else {
      user = await this.userService.ensureUserByEmail(body.email, body.name, body.uid).catch(() => null);
    }

    if (user) body.user = (user as any)._id.toString();
    const driver = await this.svc.create(body);
    return { user, driver };
  }

  @Get('online')
  online() {
    return this.svc.findAllOnline();
  }

  @Get(':uid')
  findByUid(@Param('uid') uid: string) {
    return this.svc.findByUid(uid);
  }

  @UseGuards(AuthenticatedGuard)
  @Patch(':uid')
  update(@Param('uid') uid: string, @Body() body: UpdateDriverDto) {
    return this.svc.updateByUid(uid, body);
  }
}

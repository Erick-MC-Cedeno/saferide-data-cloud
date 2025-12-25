import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PassangerService } from './passanger.service';
import { CreatePassangerDto } from './dto/create-passanger.dto';
import { UpdatePassangerDto } from './dto/update-passanger.dto';
import { UserService } from '../user/user.service';
import { AuthenticatedGuard } from '../guard/auth/authenticated.guard';

@Controller('passangers')
export class PassangerController {
  constructor(private readonly svc: PassangerService, private readonly userService: UserService) {}

  @Post()
  async create(@Body() body: CreatePassangerDto) {
    // create or link user first (prefer full register when password provided)
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
        // if register fails because user exists, try to ensure
        user = await this.userService.ensureUserByEmail(body.email, body.name, body.uid).catch(() => null);
      }
    } else {
      user = await this.userService.ensureUserByEmail(body.email, body.name, body.uid).catch(() => null);
    }

    if (user) body.user = (user as any)._id.toString();
    const passanger = await this.svc.create(body);
    return { user, passanger };
  }

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':uid')
  findByUid(@Param('uid') uid: string) {
    return this.svc.findByUid(uid);
  }

  @UseGuards(AuthenticatedGuard)
  @Patch(':uid')
  update(@Param('uid') uid: string, @Body() body: UpdatePassangerDto) {
    return this.svc.updateByUid(uid, body);
  }
}

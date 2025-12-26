import { Body, Controller, Get, Param, Patch, Post, UseGuards, BadRequestException } from '@nestjs/common';
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
    const [firstName, ...rest] = (body.name || '').split(' ');
    const lastName = rest.join(' ') || '';
      // Validate that the email is not already registered in `users`.
      const existingUser = await this.userService.getUserByEmail(body.email);
      if (existingUser) {
        throw new BadRequestException('Email already registered');
      }

      // If passwords were provided, ensure they match
      if (body.password || (body as any).confirmPassword) {
        if (!body.password || !(body as any).confirmPassword || body.password !== (body as any).confirmPassword) {
          throw new BadRequestException('Passwords do not match');
        }
      }

      const ensured = await this.userService.ensureFullUserByEmail(body.email, `${firstName} ${lastName}`, body.password).catch((e) => {
        console.error('[DriverController] ensureFullUserByEmail error', e && (e as any).message ? (e as any).message : e);
        return null;
      });
      console.log('[DriverController] ensured user=', ensured && (ensured as any)._id ? (ensured as any)._id.toString() : null);
      if (ensured) {
        // ensure role is set to driver
        try {
          if ((ensured as any).role !== 'driver') {
            (ensured as any).role = 'driver';
            await (ensured as any).save();
          }
        } catch (e) {
          console.error('[DriverController] failed to set role on user', e && (e as any).message ? (e as any).message : e);
        }
        body.user = (ensured as any)._id.toString();
      }
    const driver = await this.svc.create(body);
    return { user: ensured, driver };
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

import { Body, Controller, Get, Param, Patch, Post, UseGuards, BadRequestException } from '@nestjs/common';
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
    // Validate that the email is not already registered in `users`.
    const existingUser = await this.userService.getUserByEmail(body.email);
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    // Ensure there is a full `User` record for this email (creates if missing).
    const [firstName, ...rest] = (body.name || '').split(' ');
    const lastName = rest.join(' ') || '';
    const ensured = await this.userService.ensureFullUserByEmail(body.email, `${firstName} ${lastName}`, body.password).catch((e) => {
      console.error('[PassangerController] ensureFullUserByEmail error', e && (e as any).message ? (e as any).message : e);
      return null;
    });
    console.log('[PassangerController] ensured user=', ensured && (ensured as any)._id ? (ensured as any)._id.toString() : null);
    if (ensured) body.user = (ensured as any)._id.toString();
    const passanger = await this.svc.create(body);
    return { user: ensured, passanger };
  }

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':email')
  findByEmail(@Param('email') email: string) {
    return this.svc.findByEmail(email);
  }

  @UseGuards(AuthenticatedGuard)
  @Patch(':email')
  update(@Param('email') email: string, @Body() body: UpdatePassangerDto) {
    return this.svc.updateByEmail(email, body);
  }
}

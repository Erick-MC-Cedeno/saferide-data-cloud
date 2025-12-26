import { Injectable, BadRequestException, NotFoundException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Model } from 'mongoose';
import { HashService } from './hash.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { TwoFactorAuthService } from '../two-factor/verification.service';
import { UpdateProfileDto } from './dto/update-profile';
import { EmailService } from './email.service';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private hashService: HashService,
    private twoFactorAuthService: TwoFactorAuthService,
    private emailService: EmailService
  ) {}

  async getUserByEmail(email: string) {
    return this.userModel.findOne({ email }).exec();
  }

  async getUserById(id: string) {
    return this.userModel.findById(id).exec();
  }

  async register(createUserDto: CreateUserDto) {
    console.log('[UserService.register] creating user with email=', createUserDto.email);
    // validate confirmPassword if provided
    if ((createUserDto as any).confirmPassword && createUserDto.password !== (createUserDto as any).confirmPassword) {
      console.log('[UserService.register] password and confirmPassword do not match for email=', createUserDto.email);
      throw new BadRequestException('Passwords do not match');
    }

    const createUser = new this.userModel(createUserDto);
    const user = await this.getUserByEmail(createUserDto.email);
    if (user) {
      console.log('[UserService.register] user already exists for email=', createUserDto.email);
      throw new BadRequestException();
    }

    createUser.password = await this.hashService.hashPassword(createUser.password);
    try {
      const saved = await createUser.save();
      console.log('[UserService.register] saved user id=', saved._id?.toString());
      return saved;
    } catch (err) {
      console.error('[UserService.register] error saving user', err && (err as any).message ? (err as any).message : err);
      throw err;
    }
  }

  async isEmailVerified(email: string): Promise<{ isVerified: boolean; message: string }> {
    const user = await this.getUserByEmail(email);
    if (!user) {
        throw new BadRequestException('El usuario con el correo proporcionado no existe.');
    }
    
    if (user.isValid) {
        return { isVerified: true, message: 'Correo verificado con éxito.' };
    } else {
        return { isVerified: false, message: 'El correo aún no está verificado.' };
    }
}

async verifyEmail(email: string): Promise<boolean> {
  const user = await this.getUserByEmail(email);
  
  if (!user) {
      throw new BadRequestException('Usuario no existe.');
  }
  
  if (user.isValid) {
      throw new BadRequestException('Correo ya verificado.');
  }
  
  try {
      user.isValid = true;
      await user.save();
      return true;
  } catch {
      throw new BadRequestException('Error al verificar correo.');
  }
}

async sendVerificationEmail(email: string): Promise<boolean> {
  const user = await this.getUserByEmail(email);
  
  if (!user) {
      throw new BadRequestException('Usuario no existe.');
  }

  if (user.isValid) {
      throw new BadRequestException('Correo ya verificado. No se puede reenviar.');
  }
  
  try {
      await this.emailService.sendVerificationEmail(user.email);
      return true;
  } catch {
      throw new BadRequestException('Error al enviar correo.');
  }
}


  async updateUserToken(email: string, token: string) {
    return this.userModel.findOneAndUpdate({ email }, { token, isValid: false }).exec();
  }

  async validateUserToken(email: string, token: string) {
    const user = await this.getUserByEmail(email);
    if (user && user.token === token && !user.isValid) {
      user.isValid = true;
      await user.save();
      return true;
    }
    return false;
  }

  async sendVerificationToken(email: string): Promise<void> {
    const user = await this.getUserByEmail(email);
    if (user?.isTokenEnabled) {
      try {
        await this.twoFactorAuthService.sendToken(email);
      } catch (error) {
        throw new InternalServerErrorException('Failed to send verification token.');
      }
    }
  }

  async resendVerificationToken(email: string): Promise<void> {
    const user = await this.getUserByEmail(email);
    if (user?.isTokenEnabled) {
      try {
        await this.twoFactorAuthService.resendToken(email);
      } catch (error) {
        throw new InternalServerErrorException('Failed to resend verification token.');
      }
    }
  }

  async changePassword(email: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const isPasswordValid = await this.hashService.comparePassword(changePasswordDto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    if (changePasswordDto.newPassword !== changePasswordDto.confirmNewPassword) {
      throw new BadRequestException('Las nuevas contraseñas no coinciden');
    }

    user.password = await this.hashService.hashPassword(changePasswordDto.newPassword);
    await user.save();
    return { message: 'Contraseña actualizada con éxito' };
  }

  async updateProfile(email: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
  
    user.firstName = updateProfileDto.firstName || user.firstName;
    user.lastName = updateProfileDto.lastName || user.lastName;
    
    if (updateProfileDto.email) {
      const existingUser = await this.userModel.findOne({ email: updateProfileDto.email });
      if (existingUser && existingUser.email !== email) {
        throw new BadRequestException('El correo electrónico ya está en uso');
      }
      user.email = updateProfileDto.email;
    }
  
    await user.save();
    return { message: 'Perfil actualizado con éxito' };
  }

  // Ensure a user exists for the given email; create a minimal user if missing.
  async ensureUserByEmail(email: string, fullName?: string) {
    if (!email) throw new BadRequestException('Email required to ensure user');

    const user = await this.getUserByEmail(email);
    // Do NOT create a minimal user here. Only return existing user or null.
    return user || null;
  }

  // Ensure a full User record exists for the given email. If it doesn't, create
  // one using the provided password or a generated secure password. Returns the
  // created or existing User.
  async ensureFullUserByEmail(email: string, fullName?: string, password?: string) {
    if (!email) throw new BadRequestException('Email required to ensure user');

    const existing = await this.getUserByEmail(email);
    if (existing) return existing;

    const [firstName, ...rest] = (fullName || '').split(' ');
    const lastName = rest.join(' ') || '';
    const pw = password || (Math.random().toString(36).slice(-12) + 'A1!a');

    try {
      return await this.register({
        firstName: firstName || '',
        lastName: lastName,
        email,
        password: pw,
        confirmPassword: pw,
      });
    } catch (err: any) {
      // If user was created concurrently, return the existing user
      if (err instanceof BadRequestException) {
        return this.getUserByEmail(email);
      }
      throw err;
    }
  }
}

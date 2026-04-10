import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  private async generateTokens(payload: any) {
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '5h',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  async signup(dto: any) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        password: hashedPassword,
        role: dto.role,
      },
    });

    if (dto.role === 'student') {
      await this.prisma.studentProfile.create({
        data: {
          userId: user.id,
          username: dto.username,
        },
      });
    }

    if (dto.role === 'teacher') {
      await this.prisma.teacherProfile.create({
        data: {
          userId: user.id,
          subject: dto.subject,
          institution: dto.institution,
          bio: dto.bio,
        },
      });
    }

    return {
      user,
      message: 'Signup successful',
    };
  }

  async signin(dto: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);

    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = await this.generateTokens(payload);

    return {
      user,
      ...tokens,
    };
  }

  async googleLogin(req: any) {
    const googleUser = req.user;

    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          firstName: googleUser.firstName,
          lastName: googleUser.lastName,
          role: googleUser.roleIntent || 'student',
        },
      });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = await this.generateTokens(payload);

    return {
      user,
      ...tokens,
    };
  }

  async forgetPassword(dto: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new NotFoundException();

    const token = await this.jwtService.signAsync(
      { email: user.email },
      { expiresIn: '15m' },
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await this.mailService.sendResetPasswordMail(user.email, resetLink);

    return {
      message: 'Reset password link sent',
    };
  }

  async resetPassword(dto: any) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const payload = await this.jwtService.verifyAsync(dto.token, {
      secret: process.env.JWT_SECRET,
    });
    

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.prisma.user.update({
      where: { email: payload.email },
      data: { password: hashedPassword },
    });

    return {
      message: 'Password reset successful',
    };
  }

  async refreshToken(dto: any) {
    const payload = await this.jwtService.verifyAsync(dto.refreshToken, {
      secret: process.env.JWT_SECRET,
    });

    return this.generateTokens(payload);
  }
}
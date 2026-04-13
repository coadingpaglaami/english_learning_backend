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

    if (dto.role === 'admin') {
      throw new BadRequestException('Cannot sign up as admin');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        password: hashedPassword,
        role: dto.role,
        isOnboarded: true,
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

    const { password, ...updatedUser } = user;

    return {
      updatedUser,
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
      isOnboarded: user.isOnboarded,
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
          isOnboarded: false, // Force them through onboarding
        },
      });
    }

    // Include isOnboarded in the token payload
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isOnboarded: user.isOnboarded, // <--- Add this
    };

    const tokens = await this.generateTokens(payload);
    return { user, ...tokens };
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
  try {
    const payload = await this.jwtService.verifyAsync(dto.refreshToken, {
      secret: process.env.JWT_SECRET,
    });

    // IMPORTANT: Remove iat and exp so the new token gets fresh ones
    const { iat, exp, ...cleanPayload } = payload;

    return this.generateTokens(cleanPayload);
  } catch (error) {
    const err = error as { message?: string };
    // This will help you see if the refresh token itself is expired
    console.error("JWT Verification Error:", err.message);
    throw new UnauthorizedException('Invalid or expired refresh token');
  }
}


  async checkUsername(username: string) {
    if (!username) {
      return { available: false };
    }

    const existing = await this.prisma.studentProfile.findUnique({
      where: { username },
    });

    return {
      available: !existing,
    };
  }

  async completeProfile(userId: string, dto: any) {
    // 1. Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found');

    // 2. Use UPSERT instead of update to handle missing profile records
    if (user.role === 'student') {
      await this.prisma.studentProfile.upsert({
        where: { userId: userId },
        // If profile doesn't exist, create it
        create: {
          userId: userId,
          username: dto.username,
        },
        // If profile exists, update it
        update: {
          username: dto.username,
        },
      });
    }

    if (user.role === 'teacher') {
      await this.prisma.teacherProfile.upsert({
        where: { userId: userId },
        create: {
          userId: userId,
          subject: dto.subject,
          institution: dto.institution,
          bio: dto.bio,
        },
        update: {
          subject: dto.subject,
          institution: dto.institution,
          bio: dto.bio,
        },
      });
    }

    // 3. Finally, update the User's onboarded status
    // We do this separately to ensure it happens regardless of the profile type
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isOnboarded: true },
    });

    // 4. Generate new tokens with the updated isOnboarded: true payload
    const payload = {
      sub: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      isOnboarded: true,
    };

    const tokens = await this.generateTokens(payload);

    return {
      user: updatedUser,
      ...tokens,
    };
  }
}

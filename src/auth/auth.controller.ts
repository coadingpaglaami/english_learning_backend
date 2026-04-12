import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';

import type {
  ForgetPasswordRequestDto,
  LoginRequestDto,
  ResetPasswordRequestDto,
  SignUpDtoRequestDto,
} from './dto/auth.dto';

import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { GoogleRoleGuard } from 'src/guards/google-role.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignUpDtoRequestDto) {
    return this.authService.signup(dto);
  }

  @Post('signin')
  async signin(
    @Body() dto: LoginRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.signin(dto);
    const { password, ...userResponse } = user;

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 5 * 60 * 60 * 1000, // 5 hours
      path: '/',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
    console.log('User signed in:', userResponse); // Debugging line to check the user object
    return { success: true, userResponse };
  }

  @Post('forget-password')
  forgetPassword(@Body() dto: ForgetPasswordRequestDto) {
    return this.authService.forgetPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordRequestDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh_token')
  async refreshToken(@Req() req: any, @Res() res: Response) {
    const refreshToken = req.cookies?.refreshToken;

    const tokens = await this.authService.refreshToken({ refreshToken });

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      domain: process.env.COOKIE_DOMAIN || 'localhost',
      path: '/',
    });

    return res.json({ success: true });
  }

  @Get('google')
  @UseGuards(GoogleRoleGuard) // This guard MUST be the one forwarding the state
  async googleAuth(@Req() req) {
    // This method is empty; the AuthGuard handles the redirect to Google
  }

  // 2. This is the endpoint Google calls back to
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.googleLogin(req);
    const { accessToken, refreshToken, user } = result;

    const isProd = process.env.NODE_ENV === 'production';

    // Set Cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProd, // Must be false on localhost (HTTP)
      sameSite: isProd ? 'none' : 'lax', // 'lax' is required for localhost
      path: '/',
      maxAge: 5 * 60 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Determine redirect URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // Check if user needs onboarding
    if (!user.isOnboarded) {
      return res.redirect(`${frontendUrl}/onboarding`);
    }

    return res.redirect(`${frontendUrl}/dashboard`);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: any) {
    console.log('User info from JWT:', req.user); // Debugging line to check the user object
    const { sub, email, role, isOnboarded } = req.user;

    return { sub, email, role, isOnboarded };
  }

  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    return res.json({ success: true });
  }

  @Get('check-username')
  checkUsername(@Query('username') username: string) {
    return this.authService.checkUsername(username);
  }

  @Post('complete-profile')
  @UseGuards(AuthGuard('jwt'))
  async completeProfile(
    @Req() req: any,
    @Body() dto: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user.sub;
    console.log(userId);
    const { accessToken, refreshToken, user } =
      await this.authService.completeProfile(userId, dto);
    const { password, ...userResponse } = user;

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 5 * 60 * 60 * 1000, // 5 hours
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return { success: true, userResponse };
  }
}

import {
  Body,
  Controller,
  Get,
  Post,
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignUpDtoRequestDto) {
    return this.authService.signup(dto);
  }

  @Post('signin')
  async signin(@Body() dto: LoginRequestDto, @Res() res: Response) {
    const { accessToken, refreshToken } = await this.authService.signin(dto);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      domain: process.env.COOKIE_DOMAIN || 'localhost',
      path: '/',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      domain: process.env.COOKIE_DOMAIN || 'localhost',
      path: '/',
    });

    return res.json({ success: true });
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
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.googleLogin(req);
    const { accessToken, refreshToken } = result;

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      domain: process.env.COOKIE_DOMAIN || 'localhost',
      path: '/',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      domain: process.env.COOKIE_DOMAIN || 'localhost',
      path: '/',
    });

    return res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: any) {
    return req.user;
  }

  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    return res.json({ success: true });
  }
}
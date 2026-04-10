import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  // 🔑 Forgot Password OTP
  async sendResetPasswordMail(to: string, resetLink: string) {
    const html = `
    <div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Password Reset Request</h2>

      <p>Hello,</p>

      <p>You requested to reset your password. Click the button below to create a new password:</p>

      <div style="margin: 20px 0;">
        <a 
          href="${resetLink}" 
          style="
            background:#2d89ef;
            color:#fff;
            padding:12px 20px;
            text-decoration:none;
            border-radius:6px;
            font-weight:bold;
          "
        >
          Reset Password
        </a>
      </div>

      <p>This link will expire in <b>15 minutes</b>.</p>

      <p>If the button doesn't work, copy and paste this link into your browser:</p>

      <p style="word-break:break-all;">
        ${resetLink}
      </p>

      <hr/>

      <p style="font-size:12px;color:#666;">
        If you didn’t request a password reset, you can safely ignore this email.
      </p>
    </div>
  `;
  }
}

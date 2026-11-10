import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';

type TestEmailSink = (mail: { type: 'reset' | 'verification'; to: string; link: string }) => void;
let testEmailSink: TestEmailSink | null = null;

export class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    if (config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE,
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS,
        },
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.transporter);
  }

  /**
   * Safe test hook strictly for vitest suites to verify dispatching
   * without logging tokens/links to console or files.
   */
  static setTestEmailSink(sink: TestEmailSink | null): void {
    if (process.env.NODE_ENV === 'test') {
      testEmailSink = sink;
    }
  }

  async sendPasswordResetEmail(to: string, resetLink: string, userName?: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'test' && testEmailSink) {
      testEmailSink({ type: 'reset', to, link: resetLink });
    }

    const greeting = userName ? `Hello ${userName},` : 'Hello,';
    const subject = 'Reset your ShopPilot password';

    const textContent = `${greeting}

We received a request to reset the password for your ShopPilot account.
Click the link below to set a new password:

${resetLink}

This link is valid for 1 hour. If you did not request this, you can safely ignore this email.

— The ShopPilot Team`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset your ShopPilot password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f9f9; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e1e9e8; padding: 36px 32px; box-shadow: 0 4px 16px rgba(10,53,64,0.06);">
    <div style="margin-bottom: 24px; display: flex; align-items: center;">
      <span style="font-size: 22px; font-weight: 800; color: #0A3540; letter-spacing: -0.5px;">ShopPilot <span style="color: #0E6258;">AI</span></span>
    </div>
    <h1 style="font-size: 20px; font-weight: 700; color: #162a2d; margin-top: 0; margin-bottom: 12px;">Password Reset Request</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #536b6e; margin-bottom: 24px;">
      ${greeting}<br>
      We received a request to reset your ShopPilot account password. Click the button below to choose a new password.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetLink}" style="background-color: #0E6258; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 9999px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 2px 8px rgba(14,98,88,0.25);">Reset Password</a>
    </div>
    <p style="font-size: 12px; color: #7f9799; line-height: 1.5; margin-top: 24px;">
      If the button above doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetLink}" style="color: #0E6258; word-break: break-all;">${resetLink}</a>
    </p>
    <hr style="border: none; border-top: 1px solid #eef2f2; margin: 28px 0 20px 0;">
    <p style="font-size: 11px; color: #9ab0b2; margin: 0; line-height: 1.4;">
      This link will expire in 1 hour. If you didn't request a password reset, no action is needed and your account remains secure.
    </p>
  </div>
</body>
</html>
`;

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: config.EMAIL_FROM,
          to,
          subject,
          text: textContent,
          html: htmlContent,
        });
        return true;
      } catch (err) {
        console.error(`[EmailService] Failed to send email to ${to}:`, err);
        return false;
      }
    }

    // When SMTP is not configured, simulate delivery safely without leaking credentials/tokens to logs
    return true;
  }

  async sendVerificationEmail(to: string, verificationLink: string, userName?: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'test' && testEmailSink) {
      testEmailSink({ type: 'verification', to, link: verificationLink });
    }

    const greeting = userName ? `Hello ${userName},` : 'Hello,';
    const subject = 'Verify your ShopPilot email address';

    const textContent = `${greeting}

Thank you for signing up for ShopPilot AI.
Please confirm your email address by clicking the link below:

${verificationLink}

This link is valid for 24 hours.

— The ShopPilot Team`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify your ShopPilot email address</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f9f9; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e1e9e8; padding: 36px 32px; box-shadow: 0 4px 16px rgba(10,53,64,0.06);">
    <div style="margin-bottom: 24px; display: flex; align-items: center;">
      <span style="font-size: 22px; font-weight: 800; color: #0A3540; letter-spacing: -0.5px;">ShopPilot <span style="color: #0E6258;">AI</span></span>
    </div>
    <h1 style="font-size: 20px; font-weight: 700; color: #162a2d; margin-top: 0; margin-bottom: 12px;">Verify Your Email Address</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #536b6e; margin-bottom: 24px;">
      ${greeting}<br>
      Please confirm that this is your email address to secure your ShopPilot household account.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${verificationLink}" style="background-color: #0E6258; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 9999px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 2px 8px rgba(14,98,88,0.25);">Verify Email</a>
    </div>
    <p style="font-size: 12px; color: #7f9799; line-height: 1.5; margin-top: 24px;">
      If the button above doesn't work, copy and paste this link into your browser:<br>
      <a href="${verificationLink}" style="color: #0E6258; word-break: break-all;">${verificationLink}</a>
    </p>
    <hr style="border: none; border-top: 1px solid #eef2f2; margin: 28px 0 20px 0;">
    <p style="font-size: 11px; color: #9ab0b2; margin: 0; line-height: 1.4;">
      This link will expire in 24 hours. If you did not create a ShopPilot account, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
`;

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: config.EMAIL_FROM,
          to,
          subject,
          text: textContent,
          html: htmlContent,
        });
        return true;
      } catch (err) {
        console.error(`[EmailService] Failed to send email to ${to}:`, err);
        return false;
      }
    }

    // When SMTP is not configured, simulate delivery safely without leaking credentials/tokens to logs
    return true;
  }
}


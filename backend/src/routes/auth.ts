import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection.js';
import { AuthService } from '../services/AuthService.js';
import { EmailService } from '../services/EmailService.js';
import { readSessionToken, requireAuthentication, resolveSessionIfPresent, SESSION_COOKIE } from '../middleware/auth.js';
import { rateLimit, loginFailureLimit, unauthenticatedApiRateLimit } from '../middleware/rateLimit.js';
import { config } from '../config.js';

export const authRouter = Router();

const Email = z.string().trim().email().max(254);
const PasswordRule = z.string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(128, 'Password cannot exceed 128 characters.')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special symbol (e.g. @, #, $, !).');

const RegisterSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name cannot exceed 80 characters'),
  email: Email,
  password: PasswordRule,
});
const LoginSchema = z.object({ email: Email, password: z.string().min(1).max(128) });

function setSessionCookie(res: Response, token: string): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${secure}`);
}

function clearSessionCookie(res: Response): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

authRouter.post('/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 5, key: req => `ip:${req.ip}` }, 'signup'), (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RegisterSchema.parse(req.body);
    const payload = { name: parsed.name!, email: parsed.email!, password: parsed.password! };
    new AuthService(getDatabase()).register(payload);
    res.status(202).json({ message: 'If registration can be completed, sign in to continue.' });
  } catch (err) { next(err); }
});

authRouter.post('/login',
  loginFailureLimit(15 * 60 * 1000, 20, req => `ip:${req.ip}`, 'login-ip'),
  loginFailureLimit(15 * 60 * 1000, 5, req => `account-ip:${String(req.body?.email || '').trim().toLowerCase()}|${req.ip}`, 'login-account'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = LoginSchema.parse(req.body);
      const result = new AuthService(getDatabase()).login(payload.email, payload.password);
      setSessionCookie(res, result.token);
      res.json({ user: result.user });
    } catch (err) { next(err); }
  }
);

authRouter.post('/logout', (req: Request, res: Response) => {
  new AuthService(getDatabase()).logout(readSessionToken(req));
  clearSessionCookie(res);
  res.status(204).end();
});

const ForgotPasswordSchema = z.object({
  email: Email,
});

const ResetPasswordSchema = z.object({
  token: z.string().min(10, 'Reset token is missing or invalid'),
  newPassword: PasswordRule,
});

authRouter.post('/forgot-password', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, key: req => `ip:${req.ip}` }, 'forgot-password'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = ForgotPasswordSchema.parse(req.body);
    const authService = new AuthService(getDatabase());
    const result = authService.createPasswordReset(email);

    if (result) {
      const resetLink = `${config.APP_BASE_URL}/reset-password?token=${encodeURIComponent(result.resetToken)}`;
      const emailService = new EmailService();
      await emailService.sendPasswordResetEmail(result.user.email, resetLink, result.user.name);
    }

    res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/reset-password', rateLimit({ windowMs: 15 * 60 * 1000, max: 15, key: req => `ip:${req.ip}` }, 'reset-password'), (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = ResetPasswordSchema.parse(req.body);
    const authService = new AuthService(getDatabase());
    authService.resetPassword(token, newPassword);
    clearSessionCookie(res);
    res.json({ success: true, message: 'Password has been reset successfully. Please log in with your new password.' });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', resolveSessionIfPresent, unauthenticatedApiRateLimit, requireAuthentication, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

const UpdateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(80, 'Name cannot exceed 80 characters').optional(),
  currentPassword: z.string().max(128).optional(),
  newPassword: PasswordRule.optional(),
});

authRouter.patch('/profile', resolveSessionIfPresent, requireAuthentication, (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = UpdateProfileSchema.parse(req.body);
    const cleanCurrentPassword = payload.currentPassword?.trim() ? payload.currentPassword.trim() : undefined;
    const updated = new AuthService(getDatabase()).updateProfile(req.user!.id, {
      ...payload,
      currentPassword: cleanCurrentPassword,
    });
    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
});

authRouter.delete('/account', resolveSessionIfPresent, requireAuthentication, (req: Request, res: Response, next: NextFunction) => {
  try {
    new AuthService(getDatabase()).deleteAccount(req.user!.id);
    clearSessionCookie(res);
    res.json({ success: true, message: 'Account deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/google/config', (_req: Request, res: Response) => {
  res.json({
    enabled: Boolean(config.GOOGLE_CLIENT_ID),
    clientId: config.GOOGLE_CLIENT_ID || null,
  });
});

const GoogleAuthSchema = z.object({
  credential: z.string().min(1),
});

authRouter.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { credential } = GoogleAuthSchema.parse(req.body);
    if (!config.GOOGLE_CLIENT_ID) {
      res.status(400).json({ error: { code: 'GOOGLE_AUTH_DISABLED', message: 'Google Sign-In is not configured.' } });
      return;
    }

    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!verifyRes.ok) {
      res.status(401).json({ error: { code: 'INVALID_CREDENTIAL', message: 'Invalid Google credential.' } });
      return;
    }

    const payload = await verifyRes.json() as {
      aud?: string;
      email?: string;
      name?: string;
      email_verified?: string | boolean;
    };

    if (payload.aud !== config.GOOGLE_CLIENT_ID) {
      res.status(401).json({ error: { code: 'AUDIENCE_MISMATCH', message: 'Google token was not issued for this client.' } });
      return;
    }

    if (!payload.email || (payload.email_verified !== 'true' && payload.email_verified !== true)) {
      res.status(401).json({ error: { code: 'UNVERIFIED_EMAIL', message: 'Google account email is not verified.' } });
      return;
    }

    const result = new AuthService(getDatabase()).loginWithGoogle({
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
    });

    setSessionCookie(res, result.token);
    res.json({ user: result.user });
  } catch (err) {
    next(err);
  }
});

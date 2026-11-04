import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection.js';
import { AuthService } from '../services/AuthService.js';
import { readSessionToken, requireAuthentication, SESSION_COOKIE } from '../middleware/auth.js';
import { config } from '../config.js';

export const authRouter = Router();

const Email = z.string().trim().email().max(254);
const RegisterSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: Email,
  password: z.string().min(12).max(128)
    .regex(/[a-z]/, 'Password must contain a lowercase letter.')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter.')
    .regex(/[0-9]/, 'Password must contain a number.')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a symbol.'),
});
const LoginSchema = z.object({ email: Email, password: z.string().min(1).max(128) });

function setSessionCookie(res: Response, token: string): void {
  const secure = config.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${secure}`);
}

function clearSessionCookie(res: Response): void {
  const secure = config.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

authRouter.post('/register', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RegisterSchema.parse(req.body);
    const payload = { name: parsed.name!, email: parsed.email!, password: parsed.password! };
    const result = new AuthService(getDatabase()).register(payload);
    setSessionCookie(res, result.token);
    res.status(201).json({ user: result.user });
  } catch (err) { next(err); }
});

authRouter.post('/login', (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = LoginSchema.parse(req.body);
    const result = new AuthService(getDatabase()).login(payload.email, payload.password);
    setSessionCookie(res, result.token);
    res.json({ user: result.user });
  } catch (err) { next(err); }
});

authRouter.post('/logout', (req: Request, res: Response) => {
  new AuthService(getDatabase()).logout(readSessionToken(req));
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuthentication, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

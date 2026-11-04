import { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { getDatabase } from '../db/connection.js';
import { AppError } from './errorHandler.js';

interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'guest';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const SESSION_COOKIE = 'shoppilot_session';

export function readSessionToken(req: Request): string | undefined {
  const rawCookie = req.headers.cookie || '';
  const value = rawCookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return value || undefined;
}

export function requireAuthentication(req: Request, _res: Response, next: NextFunction): void {
  const token = readSessionToken(req);
  if (!token) {
    next(new AppError('UNAUTHORIZED', 'Please log in to continue.', 401));
    return;
  }
  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const row = getDatabase().prepare(`
      SELECT u.id, u.name, u.email, u.role
      FROM auth_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `).get(tokenHash, new Date().toISOString()) as AuthenticatedUser | undefined;
    if (!row) {
      next(new AppError('UNAUTHORIZED', 'Your session has expired. Please log in again.', 401));
      return;
    }
    req.user = row;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireGuest(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== 'guest') {
    next(new AppError('FORBIDDEN', 'Future Simulation is available only to the Guest account.', 403));
    return;
  }
  next();
}

/** Test-only fixture identity; never enabled in development or production. */
export function injectTestUser(req: Request, _res: Response, next: NextFunction): void {
  req.user = {
    id: 'demo-user',
    name: 'Demo Household',
    email: 'demo@shoppilot.local',
    role: 'guest',
  };
  next();
}

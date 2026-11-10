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
      authSessionResolved?: boolean;
    }
  }
}

export const SESSION_COOKIE = 'shoppilot_session';

export function readSessionToken(req: Request): string | undefined {
  const rawCookie = req.headers.cookie || '';
  const value = rawCookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return value || undefined;
}

function resolveSessionUser(req: Request): AuthenticatedUser | undefined {
  const token = readSessionToken(req);
  if (!token) return undefined;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const row = getDatabase().prepare(`
    SELECT u.id, u.name, u.email, u.role
    FROM auth_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(tokenHash, new Date().toISOString()) as AuthenticatedUser | undefined;
  if (!row || (row.role === 'guest' && process.env.NODE_ENV === 'production')) return undefined;
  return row;
}

/** Resolve a valid session when present without rejecting anonymous requests. */
export function resolveSessionIfPresent(req: Request, _res: Response, next: NextFunction): void {
  try {
    req.user = resolveSessionUser(req);
    req.authSessionResolved = true;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuthentication(req: Request, _res: Response, next: NextFunction): void {
  if (req.user) {
    next();
    return;
  }
  if (req.authSessionResolved) {
    next(new AppError('UNAUTHORIZED', 'Please log in to continue.', 401));
    return;
  }
  try {
    const user = resolveSessionUser(req);
    if (!user) {
      next(new AppError('UNAUTHORIZED', 'Please log in to continue.', 401));
      return;
    }
    req.user = user;
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

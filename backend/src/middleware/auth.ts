import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Injects a fixed demo user into all requests.
 * When real authentication (e.g. Google OAuth) is added in the future,
 * only this middleware needs to be swapped out.
 */
export function injectDemoUser(req: Request, _res: Response, next: NextFunction): void {
  req.user = {
    id: 'demo-user',
    name: 'Demo Household',
    email: 'demo@shoppilot.local',
  };
  next();
}

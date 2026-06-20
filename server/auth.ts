/** Auth helpers + role middleware. */
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from './db.ts';
import { users } from '../db/schema.ts';

export const hashPassword = (p: string) => bcrypt.hashSync(p, 10);
export const verifyPassword = (p: string, hash: string) => bcrypt.compareSync(p, hash);

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ error: 'authentication required' });
  next();
}

export function requireRole(...roles: Array<'student' | 'instructor' | 'admin'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) return res.status(401).json({ error: 'authentication required' });
    if (!roles.includes(req.session.role!)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}

export function currentUser(req: Request) {
  if (!req.session.userId) return null;
  return db.select().from(users).where(eq(users.id, req.session.userId)).get() ?? null;
}

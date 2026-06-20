/** Auth routes: signup (captures home state + auto-enrolls), login, logout. */
import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '../db.ts';
import { users } from '../../db/schema.ts';
import { hashPassword, verifyPassword } from '../auth.ts';
import { enrollUser } from '../enroll.ts';

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'password must be at least 8 characters'),
  fullName: z.string().min(1),
  homeState: z.string().length(2).optional(),
});

authRouter.post('/signup', (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid input', details: parsed.error.flatten() });
  const { email, password, fullName, homeState } = parsed.data;
  const lc = email.toLowerCase();
  if (db.select().from(users).where(eq(users.email, lc)).get()) {
    return res.status(409).json({ error: 'email already registered' });
  }
  const userId = nanoid(16);
  const state = homeState?.toUpperCase();
  db.insert(users).values({
    id: userId, email: lc, passwordHash: hashPassword(password), fullName, role: 'student', homeState: state,
  }).run();
  const enrollment = enrollUser(userId, state);
  req.session.userId = userId;
  req.session.role = 'student';
  res.status(201).json({ user: { id: userId, email: lc, fullName, role: 'student', homeState: state }, enrollment });
});

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = db.select().from(users).where(eq(users.email, String(email).toLowerCase())).get();
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  if (user.status === 'suspended') return res.status(403).json({ error: 'account suspended' });
  db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)).run();
  req.session.userId = user.id;
  req.session.role = user.role;
  res.json({ user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, homeState: user.homeState } });
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

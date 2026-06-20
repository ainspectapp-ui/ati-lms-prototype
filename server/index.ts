/**
 * ATI Academy LMS — server entry.
 *
 * This turn: a runnable foundation that serves the existing course content and
 * exposes a health check + a session-aware `/api/me`. Auth, enrollment,
 * progress, certificate, and admin routers are mounted as they land (see the
 * task list / ARCHITECTURE.md). Nothing here is wired to a third-party system.
 */
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import express from 'express';
import session from 'express-session';
import { eq, and } from 'drizzle-orm';
import { db } from './db.ts';
import { enrollments, courses, certificates, users } from '../db/schema.ts';
import { currentUser } from './auth.ts';
import { authRouter } from './routes/auth.ts';
import { progressRouter } from './routes/progress.ts';
import { coursesRouter } from './routes/courses.ts';
import { certRouter } from './routes/certificates.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const app = express();
app.use(express.json());

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    role?: 'student' | 'instructor' | 'admin';
  }
}

app.use(
  session({
    name: 'ati.sid',
    secret: process.env.SESSION_SECRET ?? 'dev-only-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  }),
);

/* ----------------------------------------------------------------- routes */
app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'ati-academy-lms' }));

// Identity probe — returns the user + their active enrollment for logged-in UI.
app.get('/api/me', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ authenticated: false });
  const enrollment = db.select().from(enrollments)
    .where(and(eq(enrollments.userId, user.id), eq(enrollments.status, 'active'))).get();
  const course = enrollment ? db.select().from(courses).where(eq(courses.id, enrollment.courseId)).get() : null;
  res.json({
    authenticated: true,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, homeState: user.homeState },
    enrollment: enrollment ? { id: enrollment.id, state: enrollment.state, course: course?.title, courseSlug: course?.slug } : null,
  });
});

app.use('/api/auth', authRouter);
app.use('/api/progress', progressRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/certificates', certRouter);

// Public certificate verification — no auth, no gate (anyone can verify a code).
app.get('/api/verify/:code', (req, res) => {
  const c = db.select().from(certificates).where(eq(certificates.verificationCode, req.params.code)).get();
  if (!c || c.revokedAt) return res.json({ valid: false });
  const u = db.select().from(users).where(eq(users.id, c.userId)).get();
  const course = db.select().from(courses).where(eq(courses.id, c.courseId)).get();
  res.json({ valid: true, certNumber: c.certNumber, holder: u?.fullName, course: course?.title, state: c.state, issuedAt: c.issuedAt });
});
// TODO (next): app.use('/admin', adminRouter)

// Gate the course content behind login. Public surface = the sign-in page +
// the auth/health API mounted above. Everything else (hub, lessons, PDFs,
// progress adapter) requires a session; unauthenticated requests are sent to
// the sign-in page.
const PUBLIC_FILES = new Set(['/account.html', '/account', '/verify.html', '/verify', '/favicon.ico', '/robots.txt']);
app.use((req, res, next) => {
  if (req.session.userId) return next();
  if (PUBLIC_FILES.has(req.path)) return next();
  return res.redirect('/account.html');
});

app.use(express.static(ROOT, { extensions: ['html'] }));

const PORT = Number(process.env.PORT ?? 8080);
app.listen(PORT, () => {
  console.log(`ATI Academy LMS listening on http://localhost:${PORT}`);
});

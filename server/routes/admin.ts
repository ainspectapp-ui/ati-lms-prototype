/**
 * Admin backend — full control panel API. All routes require the admin role.
 * Every mutation is written to the audit log.
 */
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db.ts';
import { users, enrollments, courses, certificates, lessonProgress, auditLog } from '../../db/schema.ts';
import { requireRole } from '../auth.ts';

export const adminRouter = Router();
adminRouter.use(requireRole('admin'));

const audit = (actorId: string, action: string, targetType: string, targetId: string, meta?: unknown) =>
  db.insert(auditLog).values({ id: nanoid(16), actorId, action, targetType, targetId, meta: meta ?? null }).run();

/* ------------------------------------------------------------- overview */
adminRouter.get('/overview', (_req, res) => {
  const allUsers = db.select().from(users).all();
  const enroll = db.select().from(enrollments).all();
  const certs = db.select().from(certificates).all();
  const byState: Record<string, number> = {};
  for (const e of enroll) byState[e.state || 'National'] = (byState[e.state || 'National'] || 0) + 1;
  res.json({
    users: allUsers.length,
    students: allUsers.filter((u) => u.role === 'student').length,
    admins: allUsers.filter((u) => u.role === 'admin').length,
    suspended: allUsers.filter((u) => u.status === 'suspended').length,
    enrollments: enroll.length,
    certificates: certs.filter((c) => !c.revokedAt).length,
    revoked: certs.filter((c) => !!c.revokedAt).length,
    byState,
  });
});

/* ---------------------------------------------------------------- users */
adminRouter.get('/users', (_req, res) => {
  const rows = db.select().from(users).orderBy(desc(users.createdAt)).all();
  const out = rows.map((u) => {
    const done = db.select().from(lessonProgress).where(eq(lessonProgress.userId, u.id)).all().filter((p) => p.status === 'completed').length;
    const cert = db.select().from(certificates).where(eq(certificates.userId, u.id)).get();
    const enr = db.select().from(enrollments).where(eq(enrollments.userId, u.id)).get();
    return { id: u.id, fullName: u.fullName, email: u.email, role: u.role, homeState: u.homeState, status: u.status,
      sectionsDone: done, hasCert: !!cert && !cert.revokedAt, state: enr?.state ?? u.homeState, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt };
  });
  res.json({ users: out });
});

adminRouter.get('/users/:id', (req, res) => {
  const u = db.select().from(users).where(eq(users.id, req.params.id)).get();
  if (!u) return res.status(404).json({ error: 'not found' });
  const enr = db.select().from(enrollments).where(eq(enrollments.userId, u.id)).get();
  const course = enr ? db.select().from(courses).where(eq(courses.id, enr.courseId)).get() : null;
  const progress = db.select().from(lessonProgress).where(eq(lessonProgress.userId, u.id)).all();
  const certs = db.select().from(certificates).where(eq(certificates.userId, u.id)).all();
  res.json({
    user: { id: u.id, fullName: u.fullName, email: u.email, role: u.role, homeState: u.homeState, status: u.status, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt },
    enrollment: enr ? { state: enr.state, course: course?.title, status: enr.status } : null,
    progress: progress.map((p) => ({ lessonId: p.lessonId, status: p.status, stepsDone: p.stepsDone })),
    certificates: certs.map((c) => ({ certNumber: c.certNumber, issuedAt: c.issuedAt, revokedAt: c.revokedAt })),
  });
});

adminRouter.post('/users/:id/role', (req, res) => {
  const role = req.body?.role;
  if (!['student', 'instructor', 'admin'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  if (req.params.id === req.session.userId && role !== 'admin') return res.status(400).json({ error: 'cannot demote yourself' });
  db.update(users).set({ role }).where(eq(users.id, req.params.id)).run();
  audit(req.session.userId!, 'user.role', 'user', req.params.id, { role });
  res.json({ ok: true });
});

adminRouter.post('/users/:id/suspend', (req, res) => {
  const suspend = !!req.body?.suspend;
  if (req.params.id === req.session.userId) return res.status(400).json({ error: 'cannot suspend yourself' });
  db.update(users).set({ status: suspend ? 'suspended' : 'active' }).where(eq(users.id, req.params.id)).run();
  audit(req.session.userId!, suspend ? 'user.suspend' : 'user.reinstate', 'user', req.params.id);
  res.json({ ok: true });
});

/* --------------------------------------------------------- certificates */
adminRouter.get('/certificates', (_req, res) => {
  const rows = db.select().from(certificates).orderBy(desc(certificates.issuedAt)).all();
  const out = rows.map((c) => {
    const u = db.select().from(users).where(eq(users.id, c.userId)).get();
    const course = db.select().from(courses).where(eq(courses.id, c.courseId)).get();
    return { id: c.id, certNumber: c.certNumber, holder: u?.fullName, course: course?.title, state: c.state, issuedAt: c.issuedAt, revokedAt: c.revokedAt, revokedReason: c.revokedReason };
  });
  res.json({ certificates: out });
});

adminRouter.post('/certificates/:id/revoke', (req, res) => {
  const c = db.select().from(certificates).where(eq(certificates.id, req.params.id)).get();
  if (!c) return res.status(404).json({ error: 'not found' });
  const reinstate = !!req.body?.reinstate;
  db.update(certificates).set({ revokedAt: reinstate ? null : new Date(), revokedReason: reinstate ? null : (req.body?.reason ?? 'revoked by admin') }).where(eq(certificates.id, c.id)).run();
  audit(req.session.userId!, reinstate ? 'cert.reinstate' : 'cert.revoke', 'certificate', c.id, { reason: req.body?.reason });
  res.json({ ok: true });
});

/* ---------------------------------------------------------------- audit */
adminRouter.get('/audit', (_req, res) => {
  const rows = db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(100).all();
  const out = rows.map((a) => {
    const actor = a.actorId ? db.select().from(users).where(eq(users.id, a.actorId)).get() : null;
    return { action: a.action, actor: actor?.fullName ?? a.actorId, targetType: a.targetType, targetId: a.targetId, meta: a.meta, createdAt: a.createdAt };
  });
  res.json({ audit: out });
});

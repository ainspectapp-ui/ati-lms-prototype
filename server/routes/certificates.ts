/**
 * Certificates — gated issuance + status.
 *
 * Eligibility: every required, authored section in the course must have its
 * mastery check passed (best score >= 80). A certificate is minted once, with a
 * unique number and a public verification code.
 */
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, and } from 'drizzle-orm';
import { db } from '../db.ts';
import { courses, modules, lessons, sectionState, certificates, users, auditLog } from '../../db/schema.ts';
import { requireAuth } from '../auth.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ready = (ref: string | null) => !!ref && existsSync(resolve(ROOT, ref));
const PASS = 80;

export const certRouter = Router();
certRouter.use(requireAuth);

function eligibility(userId: string, slug: string) {
  const course = db.select().from(courses).where(eq(courses.slug, slug)).get();
  if (!course) return null;
  const mods = db.select().from(modules).where(eq(modules.courseId, course.id)).all();
  const required: { title: string; storageKey: string }[] = [];
  for (const m of mods) {
    const ls = db.select().from(lessons).where(eq(lessons.moduleId, m.id)).all();
    for (const l of ls) if (l.isRequired && ready(l.contentRef) && l.storageKey) required.push({ title: l.title, storageKey: l.storageKey });
  }
  const ss = new Map(
    db.select().from(sectionState).where(eq(sectionState.userId, userId)).all().map((r) => [r.storageKey, r.value as any]),
  );
  const passed: string[] = [], remaining: string[] = [];
  for (const l of required) {
    const blob = ss.get(l.storageKey);
    const best = blob && typeof blob.assessBest === 'number' ? blob.assessBest : 0;
    (best >= PASS ? passed : remaining).push(l.title);
  }
  return { course, total: required.length, passed, remaining, eligible: required.length > 0 && remaining.length === 0 };
}

function publicCert(c: any) {
  const u = db.select().from(users).where(eq(users.id, c.userId)).get();
  const course = db.select().from(courses).where(eq(courses.id, c.courseId)).get();
  return { certNumber: c.certNumber, verificationCode: c.verificationCode, holder: u?.fullName, course: course?.title, state: c.state, issuedAt: c.issuedAt, revokedAt: c.revokedAt };
}

certRouter.get('/:slug/status', (req, res) => {
  const e = eligibility(req.session.userId!, req.params.slug);
  if (!e) return res.status(404).json({ error: 'course not found' });
  const cert = db.select().from(certificates).where(and(eq(certificates.userId, req.session.userId!), eq(certificates.courseId, e.course.id))).get();
  res.json({ eligible: e.eligible, total: e.total, passedCount: e.passed.length, remaining: e.remaining, certificate: cert ? publicCert(cert) : null });
});

certRouter.post('/:slug/claim', (req, res) => {
  const userId = req.session.userId!;
  const e = eligibility(userId, req.params.slug);
  if (!e) return res.status(404).json({ error: 'course not found' });
  let cert = db.select().from(certificates).where(and(eq(certificates.userId, userId), eq(certificates.courseId, e.course.id))).get();
  if (cert) return res.json({ certificate: publicCert(cert) });
  if (!e.eligible) return res.status(400).json({ error: 'not yet eligible', remaining: e.remaining });
  const id = nanoid(16);
  const certNumber = 'ATI-' + (e.course.state || 'NAT') + '-' + nanoid(8).toUpperCase();
  const verificationCode = nanoid(22);
  db.insert(certificates).values({ id, userId, courseId: e.course.id, certNumber, verificationCode, state: e.course.state }).run();
  db.insert(auditLog).values({ id: nanoid(16), actorId: userId, action: 'cert.issue', targetType: 'certificate', targetId: id, meta: { course: e.course.slug } }).run();
  cert = db.select().from(certificates).where(eq(certificates.id, id)).get();
  res.json({ certificate: publicCert(cert) });
});

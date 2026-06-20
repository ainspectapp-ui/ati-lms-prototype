/**
 * Progress API — the server-side replacement for the prototype's localStorage.
 * Stores each section's raw blob (keyed by its storage key) and derives
 * structured lesson_progress on write for reporting + certificate gating.
 */
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { db } from '../db.ts';
import { sectionState, lessons, lessonProgress } from '../../db/schema.ts';
import { requireAuth } from '../auth.ts';

export const progressRouter = Router();
progressRouter.use(requireAuth);

/** All section blobs for the user (the hub + sections read these back). */
progressRouter.get('/', (req, res) => {
  const rows = db.select().from(sectionState).where(eq(sectionState.userId, req.session.userId!)).all();
  const state: Record<string, unknown> = {};
  for (const r of rows) state[r.storageKey] = r.value;
  res.json({ state });
});

progressRouter.get('/:key', (req, res) => {
  const r = db.select().from(sectionState)
    .where(and(eq(sectionState.userId, req.session.userId!), eq(sectionState.storageKey, req.params.key))).get();
  res.json({ value: r?.value ?? null });
});

/** Upsert one section blob + derive lesson_progress. */
progressRouter.put('/:key', (req, res) => {
  const userId = req.session.userId!;
  const key = req.params.key;
  const value = req.body?.value ?? req.body;
  const existing = db.select().from(sectionState)
    .where(and(eq(sectionState.userId, userId), eq(sectionState.storageKey, key))).get();
  if (existing) db.update(sectionState).set({ value, updatedAt: new Date() }).where(eq(sectionState.id, existing.id)).run();
  else db.insert(sectionState).values({ id: nanoid(16), userId, storageKey: key, value }).run();
  deriveLessonProgress(userId, key, value);
  res.json({ ok: true });
});

function deriveLessonProgress(userId: string, storageKey: string, value: any) {
  const lesson = db.select().from(lessons).where(eq(lessons.storageKey, storageKey)).get();
  if (!lesson) return;
  const done = value && value.done ? Object.keys(value.done).filter((k) => value.done[k]).length : 0;
  const completed = done >= lesson.totalSteps;
  const status = completed ? 'completed' : done > 0 ? 'in_progress' : 'not_started';
  const patch = {
    status: status as 'completed' | 'in_progress' | 'not_started',
    stepsDone: done, lastViewedAt: new Date(), completedAt: completed ? new Date() : null,
  };
  const existing = db.select().from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lesson.id))).get();
  if (existing) db.update(lessonProgress).set(patch).where(eq(lessonProgress.id, existing.id)).run();
  else db.insert(lessonProgress).values({ id: nanoid(16), userId, lessonId: lesson.id, ...patch }).run();
}

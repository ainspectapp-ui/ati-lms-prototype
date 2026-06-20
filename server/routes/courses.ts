/** Course API — the full module/lesson tree for a course, with the user's progress. */
import { Router } from 'express';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db.ts';
import { courses, modules, lessons, lessonProgress } from '../../db/schema.ts';
import { requireAuth } from '../auth.ts';

// A lesson is "ready" once its content file has actually been authored.
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fileExists = (ref: string | null) => !!ref && existsSync(resolve(PROJECT_ROOT, ref));

export const coursesRouter = Router();
coursesRouter.use(requireAuth);

coursesRouter.get('/:slug', (req, res) => {
  const course = db.select().from(courses).where(eq(courses.slug, req.params.slug)).get();
  if (!course) return res.status(404).json({ error: 'course not found' });

  const userId = req.session.userId!;
  const progByLesson = new Map(
    db.select().from(lessonProgress).where(eq(lessonProgress.userId, userId)).all().map((p) => [p.lessonId, p]),
  );

  const mods = db.select().from(modules).where(eq(modules.courseId, course.id)).orderBy(asc(modules.orderIndex)).all();
  let lessonsTotal = 0, lessonsComplete = 0, contentReady = 0;

  const outModules = mods.map((m) => {
    const ls = db.select().from(lessons).where(eq(lessons.moduleId, m.id)).orderBy(asc(lessons.orderIndex)).all();
    let modDone = 0;
    const outLessons = ls.map((l) => {
      const p = progByLesson.get(l.id);
      const ready = fileExists(l.contentRef);
      lessonsTotal++;
      if (ready) contentReady++;
      const done = p?.status === 'completed';
      if (done) { lessonsComplete++; modDone++; }
      return {
        id: l.id, title: l.title, slug: l.slug, contentRef: l.contentRef, ready,
        totalSteps: l.totalSteps, isRequired: l.isRequired,
        status: p?.status ?? 'not_started', stepsDone: p?.stepsDone ?? 0,
      };
    });
    return {
      id: m.id, code: m.code, title: m.title, summary: m.summary, requiredHours: m.requiredHours,
      kind: m.kind, examGate: m.examGate, lessonsDone: modDone, lessonsTotal: ls.length, lessons: outLessons,
    };
  });

  res.json({
    course: { slug: course.slug, title: course.title, summary: course.summary, state: course.state, requiredHours: course.requiredHours },
    modules: outModules,
    totals: {
      requiredHours: mods.reduce((a, m) => a + (m.requiredHours ?? 0), 0),
      lessonsTotal, lessonsComplete, contentReady, contentPending: lessonsTotal - contentReady,
    },
  });
});

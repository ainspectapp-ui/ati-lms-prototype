/** Enrollment: assign a learner to the right course variant for their state. */
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { db } from './db.ts';
import { courses, enrollments } from '../db/schema.ts';

/** The state variant for `state`, else the national base course. */
export function courseForState(state?: string | null) {
  if (state) {
    const variant = db.select().from(courses)
      .where(and(eq(courses.scope, 'state'), eq(courses.state, state))).get();
    if (variant) return variant;
  }
  return db.select().from(courses).where(eq(courses.slug, 'home-inspection-prelicensing')).get() ?? null;
}

export function enrollUser(userId: string, state?: string | null) {
  const course = courseForState(state);
  if (!course) return null;
  const existing = db.select().from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, course.id))).get();
  if (existing) return existing;
  const id = nanoid(16);
  db.insert(enrollments).values({
    id, userId, courseId: course.id, state: course.state ?? state ?? null, status: 'active',
  }).run();
  return db.select().from(enrollments).where(eq(enrollments.id, id)).get();
}

/**
 * ATI Academy LMS — data model (Drizzle ORM / SQLite).
 *
 * The spine of the platform. Portable to Postgres later by swapping the
 * sqlite-core imports for pg-core; column intents are kept dialect-neutral.
 */
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const now = sql`(unixepoch())`;
const ts = (name: string) => integer(name, { mode: 'timestamp' });

/* ---------------------------------------------------------------- people */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),                       // nanoid
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role', { enum: ['student', 'instructor', 'admin'] }).notNull().default('student'),
  homeState: text('home_state'),                     // 2-letter code; drives default enrollment
  status: text('status', { enum: ['active', 'suspended'] }).notNull().default('active'),
  createdAt: ts('created_at').notNull().default(now),
  lastLoginAt: ts('last_login_at'),
});

/* --------------------------------------------------------------- catalog */
// A course is the enrollable unit. A national core course can have per-state
// variants (scope='state', state set); a learner is enrolled in exactly the
// variant for their state.
export const courses = sqliteTable('courses', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  summary: text('summary'),
  scope: text('scope', { enum: ['national', 'state'] }).notNull().default('national'),
  state: text('state'),                              // 2-letter; set when scope='state'
  parentCourseId: text('parent_course_id'),          // state variant -> national base
  requiredHours: integer('required_hours'),          // licensure hour requirement, if any
  passThreshold: integer('pass_threshold').notNull().default(80),
  isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),
  createdAt: ts('created_at').notNull().default(now),
}, (t) => ({ byState: index('courses_by_state').on(t.state) }));

export const modules = sqliteTable('modules', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  code: text('code'),                                // e.g. 'I', 'II', 'III'
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  summary: text('summary'),
  requiredHours: integer('required_hours'),          // TREC-mandated classroom/field hours
  kind: text('kind', { enum: ['classroom', 'field'] }).notNull().default('classroom'),
  examGate: text('exam_gate', { enum: ['national', 'state'] }), // which exam this must precede
  orderIndex: integer('order_index').notNull().default(0),
});

export const lessons = sqliteTable('lessons', {
  id: text('id').primaryKey(),
  moduleId: text('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  contentRef: text('content_ref'),                   // served file, e.g. 'electrical.html'
  storageKey: text('storage_key'),                   // legacy localStorage key (migration aid)
  totalSteps: integer('total_steps').notNull().default(1),
  estMinutes: integer('est_minutes'),
  isRequired: integer('is_required', { mode: 'boolean' }).notNull().default(true),
  orderIndex: integer('order_index').notNull().default(0),
});

/* ------------------------------------------------------------ enrollment */
export const enrollments = sqliteTable('enrollments', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: text('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  state: text('state'),                              // the state course assigned at signup
  status: text('status', { enum: ['active', 'completed', 'expired'] }).notNull().default('active'),
  enrolledAt: ts('enrolled_at').notNull().default(now),
  completedAt: ts('completed_at'),
}, (t) => ({ uniq: uniqueIndex('enroll_user_course').on(t.userId, t.courseId) }));

/* -------------------------------------------------------------- progress */
export const lessonProgress = sqliteTable('lesson_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lessonId: text('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['not_started', 'in_progress', 'completed'] }).notNull().default('not_started'),
  stepsDone: integer('steps_done').notNull().default(0),
  lastViewedAt: ts('last_viewed_at'),
  completedAt: ts('completed_at'),
}, (t) => ({ uniq: uniqueIndex('progress_user_lesson').on(t.userId, t.lessonId) }));

/* ----------------------------------------------------------- assessment */
export const assessments = sqliteTable('assessments', {
  id: text('id').primaryKey(),
  lessonId: text('lesson_id').references(() => lessons.id, { onDelete: 'cascade' }),
  courseId: text('course_id').references(() => courses.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  kind: text('kind', { enum: ['mastery', 'final'] }).notNull().default('mastery'),
  passThreshold: integer('pass_threshold').notNull().default(80),
  questionCount: integer('question_count').notNull().default(0),
});

export const assessmentAttempts = sqliteTable('assessment_attempts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assessmentId: text('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
  attemptNo: integer('attempt_no').notNull().default(1),
  score: integer('score').notNull(),
  passed: integer('passed', { mode: 'boolean' }).notNull().default(false),
  answers: text('answers', { mode: 'json' }),
  createdAt: ts('created_at').notNull().default(now),
}, (t) => ({ byUser: index('attempts_by_user').on(t.userId, t.assessmentId) }));

/* ---------------------------------------------------------- certificates */
// A certificate is issued only when every required lesson/assessment in the
// course is complete/passed (gating enforced in application logic).
export const certificates = sqliteTable('certificates', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: text('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  certNumber: text('cert_number').notNull().unique(),
  verificationCode: text('verification_code').notNull().unique(),
  state: text('state'),
  issuedAt: ts('issued_at').notNull().default(now),
  revokedAt: ts('revoked_at'),
  revokedReason: text('revoked_reason'),
}, (t) => ({ uniq: uniqueIndex('cert_user_course').on(t.userId, t.courseId) }));

/* ------------------------------------------------- state requirement meta */
// Populated from the research workstream; drives which course a signup gets
// and what the certificate attests to.
export const stateRequirements = sqliteTable('state_requirements', {
  state: text('state').primaryKey(),                 // 2-letter code
  licenses: integer('licenses', { mode: 'boolean' }).notNull().default(false), // does the state license inspectors?
  regulator: text('regulator'),
  requiredHours: integer('required_hours'),
  requiredTopics: text('required_topics', { mode: 'json' }),
  exam: text('exam'),
  ceHours: integer('ce_hours'),
  sourceUrl: text('source_url'),
  notes: text('notes'),
  verifiedAt: ts('verified_at'),
  updatedAt: ts('updated_at').notNull().default(now),
});

/* ---------------------------------------- section state (frontend progress) */
// Per-user raw progress blob for an interactive section, keyed by the section's
// legacy storage key (e.g. 'ati_electrical_ix_v1'). The server-backed
// replacement for the prototype's localStorage; lesson_progress is derived from
// it on write for reporting + certificate gating.
export const sectionState = sqliteTable('section_state', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: ts('updated_at').notNull().default(now),
}, (t) => ({ uniq: uniqueIndex('section_state_user_key').on(t.userId, t.storageKey) }));

/* ---------------------------------------------------------- audit (admin) */
export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').references(() => users.id),
  action: text('action').notNull(),                  // e.g. 'cert.issue', 'user.suspend'
  targetType: text('target_type'),
  targetId: text('target_id'),
  meta: text('meta', { mode: 'json' }),
  createdAt: ts('created_at').notNull().default(now),
});

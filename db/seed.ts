/**
 * Seed the LMS: an admin account, the seed course (the Module II content we
 * already built, wired in as real lessons + mastery assessments), and stub
 * rows for the three states pending research.
 *
 * Idempotent — safe to run repeatedly.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '../server/db.ts';
import { users, courses, modules, lessons, assessments, stateRequirements } from './schema.ts';

const id = () => nanoid(16);

async function upsertAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@atiacademy.test';
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) return existing.id;
  const passwordHash = bcrypt.hashSync(process.env.SEED_ADMIN_PASSWORD ?? 'changeme123', 10);
  const adminId = id();
  db.insert(users).values({ id: adminId, email, passwordHash, fullName: 'Platform Admin', role: 'admin' }).run();
  console.log(`✓ admin: ${email}`);
  return adminId;
}

// The building-system sections, in order, with their real step counts.
const SECTIONS = [
  { title: 'Electrical Systems',        slug: 'electrical', file: 'electrical.html', key: 'ati_electrical_ix_v1', steps: 15, min: 180 },
  { title: 'Cooling & Heat Pumps',      slug: 'cooling',    file: 'cooling.html',    key: 'ati_cooling_ix_v1',    steps: 12, min: 144 },
  { title: 'Heating Systems',           slug: 'heating',    file: 'heating.html',    key: 'ati_heating_ix_v1',    steps: 17, min: 204 },
  { title: 'Insulation & Ventilation',  slug: 'insulation', file: 'insulation.html', key: 'ati_insulation_ix_v1', steps: 13, min: 156 },
  { title: 'Plumbing Systems',          slug: 'plumbing',   file: 'plumbing.html',   key: 'ati_plumbing_ix_v1',   steps: 13, min: 162 },
];

function seedSeedCourse() {
  const slug = 'home-inspection-prelicensing';
  let course = db.select().from(courses).where(eq(courses.slug, slug)).get();
  if (!course) {
    const courseId = id();
    db.insert(courses).values({
      id: courseId, slug, title: 'Home Inspection Pre-Licensing',
      summary: 'National core curriculum. State-specific variants are layered on per the state requirements.',
      scope: 'national', isPublished: true,
    }).run();
    course = db.select().from(courses).where(eq(courses.id, courseId)).get()!;
  }

  let mod = db.select().from(modules).where(eq(modules.courseId, course.id)).get();
  if (!mod) {
    const moduleId = id();
    db.insert(modules).values({
      id: moduleId, courseId: course.id, title: 'Module II — Property & Building Inspection',
      slug: 'module-ii', summary: 'The five building systems.', orderIndex: 1,
    }).run();
    mod = db.select().from(modules).where(eq(modules.id, moduleId)).get()!;

    SECTIONS.forEach((s, i) => {
      const lessonId = id();
      db.insert(lessons).values({
        id: lessonId, moduleId: mod!.id, title: s.title, slug: s.slug,
        contentRef: s.file, storageKey: s.key, totalSteps: s.steps, estMinutes: s.min,
        isRequired: true, orderIndex: i + 1,
      }).run();
      db.insert(assessments).values({
        id: id(), lessonId, courseId: course!.id, title: `${s.title} — Mastery check`,
        kind: 'mastery', passThreshold: 80,
      }).run();
    });
    console.log(`✓ seed course + Module II (${SECTIONS.length} lessons + mastery checks)`);
  }
  return course.id;
}

function seedStateStubs() {
  for (const state of ['NY', 'WA', 'TX']) {
    const existing = db.select().from(stateRequirements).where(eq(stateRequirements.state, state)).get();
    if (!existing) {
      db.insert(stateRequirements).values({ state, notes: 'pending research — see docs/research/state-requirements.md' }).run();
    }
  }
  console.log('✓ state requirement stubs: NY, WA, TX');
}

async function main() {
  await upsertAdmin();
  seedSeedCourse();
  seedStateStubs();
  console.log('Done.');
}
main();

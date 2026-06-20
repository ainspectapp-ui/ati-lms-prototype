/**
 * Texas (TREC) course build — full Professional Real Estate Inspector
 * qualifying education: 7 modules, 194 hours, exam-gated.
 *
 * Every teachable unit is a full interactive section (same format as the five
 * building-system sections). A section is "ready" once its content file exists
 * (the API checks the filesystem) — otherwise it shows as in-development.
 *
 * Hours cross-verified from TREC-approved provider curricula
 * (docs/research/state-requirements.md). DRAFT — confirm with TREC before use
 * for real licensure. Idempotent: rebuilds the TX course's modules each run.
 */
import 'dotenv/config';
import { nanoid } from 'nanoid';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../server/db.ts';
import { courses, modules, lessons, assessments } from './schema.ts';

const id = () => nanoid(16);

type Section = { title: string; file: string; key: string; steps: number };
type Mod = {
  code: string; title: string; hours: number; gate: 'national' | 'state';
  kind: 'classroom' | 'field'; summary: string; sections: Section[];
};

const MODULES: Mod[] = [
  { code: 'I', title: 'Property & Building Inspection I', hours: 40, gate: 'national', kind: 'classroom',
    summary: 'Structural and exterior systems — the building shell, roof, and grounds.',
    sections: [
      { title: 'Roofing & Attic', file: 'roofing.html', key: 'ati_roofing_ix_v1', steps: 14 },
      { title: 'Structure & Foundation', file: 'structure.html', key: 'ati_structure_ix_v1', steps: 14 },
      { title: 'Exterior & Site', file: 'exterior.html', key: 'ati_exterior_ix_v1', steps: 14 },
      { title: 'Interior & Components', file: 'interior.html', key: 'ati_interior_ix_v1', steps: 13 },
    ] },
  { code: 'II', title: 'Property & Building Inspection II', hours: 40, gate: 'national', kind: 'classroom',
    summary: 'Mechanical and systems inspection — electrical, HVAC, plumbing, insulation, and appliances.',
    sections: [
      { title: 'Electrical Systems', file: 'electrical.html', key: 'ati_electrical_ix_v1', steps: 15 },
      { title: 'Heating Systems', file: 'heating.html', key: 'ati_heating_ix_v1', steps: 17 },
      { title: 'Cooling & Heat Pumps', file: 'cooling.html', key: 'ati_cooling_ix_v1', steps: 12 },
      { title: 'Plumbing Systems', file: 'plumbing.html', key: 'ati_plumbing_ix_v1', steps: 13 },
      { title: 'Insulation & Ventilation', file: 'insulation.html', key: 'ati_insulation_ix_v1', steps: 13 },
      { title: 'Appliances', file: 'appliances.html', key: 'ati_appliances_ix_v1', steps: 12 },
    ] },
  { code: 'III', title: 'Analysis of Findings & Reporting', hours: 20, gate: 'national', kind: 'classroom',
    summary: 'Analyze deficiencies and document them in the TREC Property Inspection Report (REI 7-6).',
    sections: [{ title: 'Analysis of Findings & Reporting', file: 'reporting.html', key: 'ati_reporting_ix_v1', steps: 12 }] },
  { code: 'IV', title: 'Business Operations & Professional Responsibilities', hours: 10, gate: 'national', kind: 'classroom',
    summary: 'Running an inspection business ethically and professionally.',
    sections: [{ title: 'Business Operations & Ethics', file: 'business.html', key: 'ati_business_ix_v1', steps: 11 }] },
  { code: 'V', title: 'Texas Law', hours: 20, gate: 'state', kind: 'classroom',
    summary: 'Texas Occupations Code Chapter 1102 and the TREC rules (22 TAC Chapter 535).',
    sections: [{ title: 'Texas Inspector Law', file: 'texas-law.html', key: 'ati_txlaw_ix_v1', steps: 12 }] },
  { code: 'VI', title: 'Texas Standards of Practice', hours: 24, gate: 'state', kind: 'classroom',
    summary: 'The TREC Standards of Practice (§535.227–535.233) and the mandatory report form.',
    sections: [{ title: 'Texas Standards of Practice', file: 'texas-sop.html', key: 'ati_txsop_ix_v1', steps: 13 }] },
  { code: 'VII', title: 'Texas Practicum', hours: 40, gate: 'state', kind: 'field',
    summary: 'Supervised field training — five complete inspections with a professional inspector.',
    sections: [{ title: 'Texas Practicum — field training', file: 'practicum.html', key: 'ati_practicum_ix_v1', steps: 8 }] },
];

function run() {
  const course = db.select().from(courses).where(eq(courses.slug, 'home-inspection-prelicensing-tx')).get();
  if (!course) throw new Error('Run db:seed + seed-states first — TX course missing.');

  db.update(courses).set({ requiredHours: 194, passThreshold: 80, isPublished: true,
    summary: 'TREC Professional Real Estate Inspector qualifying education — 194 hours across 7 modules. National + State exam.' })
    .where(eq(courses.id, course.id)).run();

  const existing = db.select({ id: modules.id }).from(modules).where(eq(modules.courseId, course.id)).all();
  if (existing.length) db.delete(modules).where(inArray(modules.id, existing.map((m) => m.id))).run();

  let totalHours = 0, sectionCount = 0;
  MODULES.forEach((m, mi) => {
    totalHours += m.hours;
    const moduleId = id();
    db.insert(modules).values({
      id: moduleId, courseId: course.id, code: m.code, title: `Module ${m.code} — ${m.title}`,
      slug: `module-${m.code.toLowerCase()}`, summary: m.summary, requiredHours: m.hours,
      kind: m.kind, examGate: m.gate, orderIndex: mi + 1,
    }).run();
    m.sections.forEach((s, si) => {
      const lessonId = id();
      db.insert(lessons).values({
        id: lessonId, moduleId, title: s.title, slug: s.file.replace('.html', ''),
        contentRef: s.file, storageKey: s.key, totalSteps: s.steps, isRequired: m.kind !== 'field', orderIndex: si + 1,
      }).run();
      db.insert(assessments).values({ id: id(), lessonId, courseId: course.id, title: `${s.title} — Mastery check`, kind: 'mastery', passThreshold: 80 }).run();
      sectionCount++;
    });
  });

  console.log(`✓ TX course: ${MODULES.length} modules, ${totalHours} hours, ${sectionCount} sections`);
}
run();

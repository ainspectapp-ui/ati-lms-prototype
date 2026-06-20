/**
 * State layer: load the researched (DRAFT) requirements into state_requirements
 * and create per-state course variants of the national base course.
 *
 * Figures are from docs/research/state-requirements.md — verifiedAt is left NULL
 * because they still need a compliance professional's sign-off before any course
 * is marketed as license-qualifying. Idempotent.
 */
import 'dotenv/config';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { db } from '../server/db.ts';
import { courses, stateRequirements } from './schema.ts';

const id = () => nanoid(16);

const STATES = [
  {
    code: 'NY', regulator: 'New York Department of State', requiredHours: 140,
    exam: 'NYS State exam or NHIE', ceHours: 24,
    sourceUrl: 'https://dos.ny.gov/home-inspector',
    topics: ['Roofing', 'Exterior', 'Structure', 'Electrical', 'Heating', 'Cooling', 'Plumbing', 'Insulation & Ventilation', 'Interior', 'License Law', 'Report Writing', 'Ethics'],
    notes: '140 total = 100 classroom + 40 supervised field (field is inside the 140). Source: 19 NYCRR §197-2.3.',
  },
  {
    code: 'WA', regulator: 'Washington State Department of Licensing', requiredHours: 120,
    exam: 'WA State portion + national portion', ceHours: 24,
    sourceUrl: 'https://dol.wa.gov/professional-licenses/home-inspectors',
    topics: ['Roofing', 'Exterior', 'Structure/Foundation', 'Electrical', 'Heating', 'Cooling', 'Plumbing', 'Insulation & Ventilation', 'Interior', 'Fire & Safety hazards', 'WA SOP/Law', 'Report Writing'],
    notes: '120-hr Fundamentals course + up to 40 hrs field + 5 inspections. Per-topic hour split is set by board rule (confirm). Authority: RCW 18.280.',
  },
  {
    code: 'TX', regulator: 'Texas Real Estate Commission (TREC)', requiredHours: 154,
    exam: 'National + State portion (PearsonVUE)', ceHours: 32,
    sourceUrl: 'https://www.trec.texas.gov/become-licensed/professional-inspector',
    topics: ['Structural', 'Roofing', 'Exterior', 'Electrical', 'Heating', 'Cooling', 'Plumbing', 'Insulation & Ventilation', 'Appliances', 'Reporting', 'TX SOP', 'TX Law', 'Ethics/Business'],
    notes: 'Tiered: 90 (RE Inspector core) up to 194 (Professional) incl. 40-hr practicum. 154 shown is representative; re-confirm per-tier mapping + 2026 practicum-sequencing rule with TREC.',
  },
];

function baseCourseId(): string {
  const base = db.select().from(courses).where(eq(courses.slug, 'home-inspection-prelicensing')).get();
  if (!base) throw new Error('Run db:seed first — national base course missing.');
  return base.id;
}

function run() {
  const parentId = baseCourseId();
  for (const s of STATES) {
    // requirements
    const reqRow = {
      state: s.code, licenses: true, regulator: s.regulator, requiredHours: s.requiredHours,
      requiredTopics: s.topics, exam: s.exam, ceHours: s.ceHours, sourceUrl: s.sourceUrl,
      notes: s.notes, verifiedAt: null, updatedAt: new Date(),
    };
    const existing = db.select().from(stateRequirements).where(eq(stateRequirements.state, s.code)).get();
    if (existing) db.update(stateRequirements).set(reqRow).where(eq(stateRequirements.state, s.code)).run();
    else db.insert(stateRequirements).values(reqRow).run();

    // state course variant
    const slug = `home-inspection-prelicensing-${s.code.toLowerCase()}`;
    const course = db.select().from(courses).where(eq(courses.slug, slug)).get();
    if (!course) {
      db.insert(courses).values({
        id: id(), slug, title: `Home Inspection Pre-Licensing — ${s.code}`,
        summary: `${s.regulator} pathway. ${s.requiredHours} hours. Exam: ${s.exam}.`,
        scope: 'state', state: s.code, parentCourseId: parentId,
        requiredHours: s.requiredHours, isPublished: false,
      }).run();
    }
    console.log(`✓ ${s.code}: requirements + course variant`);
  }
  console.log('Done. (DRAFT data — pending compliance review.)');
}
run();

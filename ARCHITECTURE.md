# ATI Academy LMS — architecture

A **standalone**, self-hosted learning platform for home-inspection pre-licensing
training across the U.S., with state-specific course variants, gated certificates,
and a full admin backend. Self-contained — no dependencies on any other system.

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node + Express + TypeScript (ESM, run via `tsx`) |
| Database | Drizzle ORM on **SQLite** (dev) → **Postgres** (prod) — swap the driver in `server/db.ts` |
| Auth | `express-session` cookies + `bcryptjs`; roles `student / instructor / admin` |
| Frontend | The existing design system + course content (vanilla HTML/CSS/JS), progressively wired to the API |
| Certificates | Server-generated PDF + public verification page |

## Data model (`db/schema.ts`)

```
users ──< enrollments >── courses ──< modules ──< lessons ──< lesson_progress >── users
                            │                        │
                            │                        └──< assessments ──< assessment_attempts >── users
                            └──< certificates >── users
state_requirements   audit_log
```

- **courses** — enrollable unit. A `national` core course plus per-state variants
  (`scope='state'`, `state` set, `parentCourseId` → base). A learner is enrolled in
  the variant for their state.
- **modules / lessons** — content tree. Today's five building-system sections are
  seeded as lessons under "Module II" (`content_ref` points at the served HTML;
  `total_steps` mirrors each section's step count).
- **enrollments** — ties a user to the course variant for their state.
- **lesson_progress / assessment_attempts** — server-side replacement for the
  prototype's `localStorage`.
- **certificates** — issued only when every required lesson/assessment in a course
  is complete/passed; unique number + verification code; revocable.
- **state_requirements** — per-state regulator, hours, required topics, exam, CE;
  populated from the research workstream; drives enrollment + what a cert attests to.
- **audit_log** — every admin mutation, for "total control" accountability.

## Roadmap (tracked in the task list)

1. **Platform scaffold + data model** ← done
2. **Auth + roles** — signup (captures home state) / login / logout / role middleware
3. **Enrollment with state assignment** — signup → correct state course variant
4. **Server-side progress** — progress API + rewire the section frontends off `localStorage`
5. **Assessments + certificate gating** — server grading, gating rules, PDF + verification
6. **Admin backend** — users, enrollments, course/content CRUD, reports, cert issue/revoke, audit
7. **State curriculum (NY / WA / TX)** — research (in progress) → fill content gaps
   (roofing, exterior, structure, report writing, SOP, ethics, state law)

## Run it

```bash
cp .env.example .env          # set SESSION_SECRET
npm install
npm run db:generate           # generate migration SQL from the schema
npm run db:migrate            # create the SQLite DB
npm run db:seed               # admin + seed course + state stubs
npm run dev                   # http://localhost:8080
```

> ⚠ State curriculum content is **draft pending compliance review** — see
> `docs/research/state-requirements.md`. Do not use for real licensure until verified.

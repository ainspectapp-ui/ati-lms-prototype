# ATI Academy · Module II — Property &amp; Building Inspection

An interactive, self-paced LMS for All American Training Institute's home-inspector
program. Module II covers the five building systems, each taught as a deep, licensure-grade
section with diagrams you can poke, spot-the-defect drills, field tools, gated quizzes, and
an 80%-to-pass mastery check. Progress is saved per-device in the browser. No build step,
no dependencies, no server-side code — just static HTML/CSS/JS.

## Status — module complete

| # | System | Status | File |
|---|--------|--------|------|
| 1 | Electrical Systems | ✅ Live (11 lessons) | `electrical.html` |
| 2 | Cooling &amp; Heat Pumps | ✅ Live (8 lessons) | `cooling.html` |
| 3 | Heating Systems | ✅ Live (13 lessons) | `heating.html` |
| 4 | Insulation &amp; Ventilation | ✅ Live (9 lessons) | `insulation.html` |
| 5 | Plumbing Systems | ✅ Live (9 lessons) | `plumbing.html` |

All five systems are finished and wired into the hub.

## Structure

```
.
├── index.html               # Module II hub / dashboard (start here)
├── electrical.html          # System 1 — Electrical Systems
├── cooling.html             # System 2 — Cooling & Heat Pumps
├── heating.html             # System 3 — Heating Systems
├── insulation.html          # System 4 — Insulation & Ventilation
├── plumbing.html            # System 5 — Plumbing Systems
├── electrical-chapter.pdf   # Source chapter (linked from the Reference library)
├── cooling-chapter.pdf      # Source chapter
├── ati-plumbing-chapter.pdf # Source chapter
└── README.md
```

The hub (`index.html`) is a dashboard: a learning path across the five systems, overall and
per-system progress, "continue where you left off," a reference library, and a module
certificate goal. Each section is a fully self-contained single-file app.

## Design system

Every page shares one design language:

- **Type** — `Fraunces` (display), `Hanken Grotesk` (UI/body), `JetBrains Mono` (labels).
- **Palette** — warm paper canvas, brass/gold primary, deep-teal secondary, near-black
  "blueprint" dark surfaces, green/clay for pass/fail.
- **Components** — blueprint hero with a live progress ring, a guided learning path,
  per-system cards, drafting-board diagrams, spot-the-defect drills, match/sort games,
  gated quizzes, and a mastery-check ring.

Fonts load from Google Fonts; everything else is local.

## How progress is stored

Each section saves completion and quiz/mastery state to the browser's `localStorage` under
its own key:

| System | Key |
|--------|-----|
| Electrical | `ati_electrical_ix_v1` |
| Cooling | `ati_cooling_ix_v1` |
| Heating | `ati_heating_ix_v1` |
| Insulation | `ati_insulation_ix_v1` |
| Plumbing | `ati_plumbing_ix_v1` |

The hub reads those keys to compute per-system progress, an overall Module II percentage,
systems mastered, and the average mastery score. Clearing site data resets progress.
Nothing is uploaded — it's entirely client-side. (In the Claude Code preview the app uses
`window.storage`; on a normal web host it falls back to `localStorage`.)

## Local preview

Open `index.html` in a browser, or run a tiny static server from this folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy to GitHub Pages

1. Push these files to the repository **root**.
   ```bash
   git add .
   git commit -m "ATI Module II — interactive course"
   git push
   ```
2. In the repo: **Settings → Pages**.
3. Under **Build and deployment**, set **Source: Deploy from a branch**, pick your branch
   (e.g. `main`) and folder **/ (root)**, then **Save**.
4. Wait ~1 minute. Your course is live at
   `https://<your-username>.github.io/<your-repo>/`.

> To serve from a subfolder (e.g. `/module-ii/`), put the files there — all links are
> relative.

---

© All American Training Institute · Built on the *Principles of Home Inspection: Systems and
Standards* curriculum.

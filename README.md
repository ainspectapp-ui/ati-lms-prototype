# ATI · Module II — Property &amp; Building Inspection

An interactive, self-paced course for All American Training Institute's home-inspector
program. Module II covers the five building systems, each as a deep, licensure-grade
section with diagrams, spot-the-defect drills, field tools, gated quizzes, and a mastery
check. Progress is saved per-device in the browser.

## Status

| # | System | Status | Source |
|---|--------|--------|--------|
| 1 | Electrical Systems | ✅ Live (10 lessons) | Chapter 7 |
| 2 | Cooling &amp; Heat Pumps | ✅ Live (8 lessons) | Chapter 12 |
| 3 | Heating | 🚧 In development | Chapters 8–11 |
| 4 | Insulation &amp; Ventilation | 🚧 In development | Chapter 5 |
| 5 | Plumbing | 🚧 In development | Chapter 13 |

## Structure

```
.
├── index.html               # Module II hub / landing page (start here)
├── electrical.html          # System 1 — Electrical Systems
├── cooling.html             # System 2 — Cooling & Heat Pumps
├── electrical-chapter.pdf   # Source chapter, embedded in the Electrical section
├── cooling-chapter.pdf      # Source chapter, embedded in the Cooling section
└── README.md
```

Everything is plain static HTML/CSS/JS — no build step, no dependencies, no server-side
code. Fonts load from Google Fonts. The hub and every section are fully self-contained.

## Deploy to GitHub Pages

1. Create (or use) a repository and push these files to the repository **root**.
   ```bash
   git add .
   git commit -m "Add ATI Module II interactive course"
   git push
   ```
2. In the repo: **Settings → Pages**.
3. Under **Build and deployment**, set **Source: Deploy from a branch**, pick your
   branch (e.g. `main`) and folder **/ (root)**, then **Save**.
4. Wait ~1 minute. Your course is live at
   `https://<your-username>.github.io/<your-repo>/`.

> Tip: if you'd rather serve it from a subfolder (e.g. `/module-ii/`), put the files in
> that folder and the relative links still work — they're all relative.

## Local preview

Open `index.html` in a browser, or run a tiny static server from this folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How progress is stored

Each section saves completion and quiz state to the browser's `localStorage` under its own
key (`ati_electrical_ix_v1`, `ati_cooling_ix_v1`, …). The hub reads those keys to show
per-system progress and an overall module bar. Clearing site data resets progress. Nothing
is sent anywhere — it's entirely client-side.

## Adding the remaining sections

Each new system ships as one more self-contained `.html` file (plus its source PDF). When a
section is ready, drop in `heating.html` / `insulation.html` / `plumbing.html`, then flip
that entry in `index.html` from `status:'soon'` to `status:'live'` and add its `key`,
`total` (step count) and `file`. The hub already lists all five and will light up the new
card and house pin automatically.

---

© All American Training Institute · Built on the *Principles of Home Inspection: Systems and
Standards* curriculum.

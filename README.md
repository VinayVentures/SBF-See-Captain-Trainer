# SBF See Captain Trainer

Unofficial bilingual study PWA for the German **Sportbootführerschein See (SBF-See)**.

**Status:** v1.3 foundation. See [Issue #1 — v1.3 Exam Ready + Crew release gate](https://github.com/VinayVentures/SBF-See-Captain-Trainer/issues/1) for the release checklist and the roadmap below for milestones.

## What works today

- Bilingual (DE / EN) study UI with answer randomisation, notes, and honest coverage badges
- The full **285 official ELWIS SBF-See questions** (Stand 01.08.2023), imported from the source PDF and validated in CI
- 15 official navigation task templates + 8 D49 chart scenarios (Q286–Q300)
- 9-knot Knoten Academy (bilingual instructions, animated SVG paths, mastery tracking) — knot paths still need per-knot mechanical validation before v1.3 ships
- Local progress + notes with versioned export/import
- Installable PWA with offline-first caching
- Type-checked TypeScript + Vitest test suite

## What is deliberately not yet real

- English translations of the 285 questions (0 / 285 authored — Milestone B)
- DE/EN explanations + memory aids (0 / 285 — Milestone B)
- Mock exam **is locked** on the Bridge until translations + explanations reach 100%. The exam engine, thresholds (5/7, 18/23, 7/9), and 60-minute timing are wired but gated.
- Navigation answer keys / automated grading — Milestone E (requires an authoritative solutions source)
- Supabase backend, Crew + leaderboard, cloud sync — Milestone F

The app **never** claims 300/300 or "Exam Ready" until validation proves it.

## Milestones

| ID | Scope |
|----|-------|
| A ✅ | Foundation refactor: Vite+TS+PWA, catalogue schema, ELWIS importer, randomiser, tests, honest coverage |
| B | English translations + DE/EN explanations + memory aids |
| C | Learning engine: SRS, mastery states, Bilge, bookmarks, meaningful readiness |
| D | Mock exam unlocked once coverage is 100% |
| E | Navigation Academy learn/guided/independent/exam + answer grading |
| F | Supabase auth, Crew, leaderboard, cross-device sync, RLS |
| G | Knoten SVG mechanical validation, device QA, v1.3 release |

## Local development

```bash
nvm use            # -> Node 20 (see .nvmrc)
npm ci
npm run dev        # http://localhost:5173
npm test           # Vitest
npm run typecheck  # tsc --noEmit
npm run build      # -> dist/
npm run import-elwis   # regenerate data/catalogue.official.json from raw PDF
```

The importer requires `pymupdf`:
```bash
python3 -m pip install --user pymupdf
```

## Data sources

`data/raw/` holds the official ELWIS PDFs — see `data/raw/README.md`. Do not edit the parsed `data/catalogue.official.json` by hand; run `npm run import-elwis` to regenerate it.

App-authored content (translations, explanations, memory aids) lives in `data/catalogue.app.json` and is kept separate from the official material (spec §31 source separation).

## Deployment

GitHub Actions (`.github/workflows/pages.yml`) runs typecheck + tests + Vite build on every push to `main` and deploys `dist/` to GitHub Pages.

## Disclaimer

Unofficial study aid. Verify current examination information with ELWIS and the responsible examination body.

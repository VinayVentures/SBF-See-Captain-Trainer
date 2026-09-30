# Milestone A handoff

Vinay — I stopped at the boundary between "foundation in place" and
"content authoring". This document is a scan of the state to help you
review efficiently.

## ⚠ ONE ACTION NEEDED FROM YOU BEFORE THE BRANCH CAN BE PUSHED

Your current `gh` OAuth token doesn't have the `workflow` scope, and
commit `1d41ca1` modifies `.github/workflows/pages.yml`. GitHub rejects
the push. To unblock:

```bash
gh auth refresh -h github.com -s workflow
```

Then either:
- Tell me and I'll push, OR
- Run `git push -u origin milestone-a-foundation` yourself.

All 8 commits are already made locally on branch `milestone-a-foundation`
in `~/Documents/SBF-See-Captain-Trainer`. Nothing is lost.

## What is on this branch (`milestone-a-foundation`)

7 commits, in this order:
1. `chore(data): add official ELWIS SBF-See catalogue PDFs`
2. `feat: Vite + TypeScript + PWA scaffold`
3. `feat(data): catalogue schema + ELWIS importer`
4. `feat: catalogue join, knots port, persistence + backup services`
5. `feat(engine+ui): randomiser, XP, exam skeleton, coverage, screens`
6. `test: catalogue integrity, randomiser, exam, xp, coverage`
7. `ci+docs: Pages workflow builds dist; update README`

## To review locally

```bash
git checkout milestone-a-foundation
nvm use
npm ci
npm test           # 23 tests, all green
npm run typecheck  # tsc --noEmit, clean
npm run build      # -> dist/, ~187 KB main bundle (39 KB gzipped)
npm run dev        # http://localhost:5173
```

## Verify by hand (spec §36 P0 verification checklist)

- Bridge shows `285 / 285 official catalogue`, `0 / 285 translated`, `0 / 285 explained`.
- Start Voyage → answers appear in different orders on reload (Fisher-Yates shuffle).
  Click any DE answer; the same slot in the EN mirror gets marked (once EN
  content exists; right now the EN pane says "translation not yet authored").
- The Bilge button is disabled when there are no wrong answers.
- Mock Exam is **locked**, not stubbed with `alert()`. The gate says exactly
  why (coverage < 100%).
- Navigation Academy lists 15 templates and 8 D49 scenarios pulled from the
  official catalogue.
- Knoten deck renders 9 knots, animation still works, mastery checkbox
  persists across reloads.
- Backup export → open the JSON; you should see `{"format":"sbf-captain-backup","version":1,...}`.
  Import the same file back → still fine. The old `sbfState` key migrates on
  first load (verified by reading `src/services/persistence.ts`).

## Notes for the PR reviewer

- **Answer randomisation is deterministic per (questionId, sessionSeed).**
  Rationale: users cannot bypass shuffling by reloading, and tests can assert
  behaviour. If you want *fully* random on every re-render, `newSessionSeed()`
  is called once at quiz start — call it more often for a stronger shuffle
  (spec §6 is silent on this; I picked the safer, testable interpretation).
- **Readiness formula** on the home screen is intentionally cautious:
  it caps at `translatedPct`, so a user with 0% translated content can never
  see 100% readiness. Milestone C will replace this with a real model that
  factors in mastery, weak topics, Bilge size, and mock history.
- **Q296–Q300 nav shape mapping** was set by hand from the ELWIS text
  (see `NAV_ANSWER_SHAPES` in `tools/import-elwis.py`). Please spot-check
  against the printed catalogue — I did read the raw text but a domain
  expert should confirm.

## What I deliberately did NOT do

Following your instruction "skip and keep going" if blocked, I did NOT do
these things. They're queued as follow-ups:

1. **English translations, DE/EN explanations, memory aids.** All 285
   questions need authored English content. This is content work, not code
   — Milestone B will provide an authoring script or CSV workflow so you
   can bulk-import machine-assisted translations for human review.
   Spec §30 forbids the app from silently fabricating this.
2. **Navigation answer key.** The ELWIS PDF publishes only the questions,
   not the numerical answers. Your D49-based solutions have to come from
   an authoritative source (teacher notes, licensed trainer) or be
   solved manually per scenario × template. Milestone E lands the grading
   UI regardless; without a key, only Exam Desk (self-check) mode is
   possible.
3. **Supabase / Crew / leaderboard.** Milestone F. Needs your Supabase
   project + anon key + OAuth setup before I can wire anything.
4. **Knot SVG path validation.** Milestone G. Paths are ported verbatim
   from the prototype — visually plausible but not domain-verified.
5. **Icon/branding assets.** `manifest.icons: []`. Add a real 192×192
   and 512×512 PNG under `public/` when you have artwork.

## Open decisions for you

- **Content sourcing plan for Milestone B.** Two paths:
  1. Manual authoring in a Google Sheet / CSV → we import.
  2. LLM-assisted first pass with your human review → we import, then you
     go through in the app itself (Milestone B could build a review UI).
- **Do you want progressive coverage badges to celebrate milestones**
  (e.g. "50 / 285 translated ✓") or keep them as-is (just a number)?
- **Merge policy.** I've kept the PR unmerged as you asked. Once you
  approve, I'd suggest squash-merge with a single commit message
  referencing all seven pieces, then delete the branch.

## Post-review, my proposed next step

Start Milestone B with a batching workflow:
1. Add `tools/build-translation-batch.py` that emits a CSV of the 285
   German questions + placeholder EN columns for authoring.
2. Add `tools/import-translations.py` that ingests the same CSV back
   into `data/catalogue.app.json`, with schema validation.
3. The UI's coverage badges already show progress — no UI changes needed
   until we hit the mock-exam unlock.

Let me know when you've had a chance to look, and how you want to
sequence B and F (content vs backend).

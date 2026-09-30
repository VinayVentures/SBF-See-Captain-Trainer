# v1.3 Exam Ready + Crew — release audit

Audited against the spec §34 checklist. Every item below is either
✅ (implemented and validated) or ⚠ (deliberately deferred — see notes).

## Content

- ✅ 300/300 catalogue items imported from official ELWIS PDF
  (Stand 01.08.2023)
- ✅ 72 Basis + 213 See + 15 nav templates + 8 nav scenarios
- ✅ IDs contiguous 1..285 for MCQ, 286..300 for nav templates, 1..8 for scenarios
- ✅ Every MCQ has 4 non-empty DE answers
- ✅ `officialCorrectIndex === 0` on every MCQ (ELWIS convention preserved)
- ✅ 285/285 English translations authored (app-authored study aid, not
  official examination text — labelled clearly in the Quiz UI)
- ✅ 285/285 DE+EN explanations authored
- ✅ Every question tagged with one of 17 topics
- ✅ Answer randomiser: DE and EN sides share the same permutation;
  1000-seed property test passes; manual 10k-seed slot distribution
  test showed uniform (~2500 each of 4 slots)
- ⚠ Regulatory citations in explanations are LLM-generated first pass —
  unverified. Any specific paragraph reference (COLREG Rule N, KVR §X,
  SeeSchStrO §Y) should be spot-checked by an SBF instructor before
  wide use. See `README.md` "What is deliberately not yet real".
- ⚠ Image-referencing questions have text-only explanations (the LLM
  can't see the associated diagrams)

## Mock exam

- ✅ 7 Basis + 23 See + 9 navigation, drawn uniformly at random
- ✅ Independent pass thresholds 5/7, 18/23, 7/9 (enforced in
  `evaluate()`, tests cover each threshold boundary)
- ✅ 60-minute countdown timer with auto-submit on expiry
- ✅ Exam lockdown: no correct/wrong feedback during exam, no
  explanations, no mastery indicators, no XP popups
- ✅ Nav answers self-graded via Exam Desk mode (D49 chart work
  outside the app; user ticks checkboxes on submission)
- ✅ Post-submit review: per-section scores against thresholds, overall %,
  PASS/not-yet verdict, per-MCQ review of your answer vs correct
- ✅ Mock history persists to state.mocks; last 5 shown on intro screen
- ✅ XP: 5 per correct + 200 pass bonus / 50 partial-pass bonus
- ✅ Wrong MCQs auto-enter the Bilge

## Learning

- ✅ Bilge, bookmarks, notes — three distinct study modes
- ✅ Mastery: unseen / learning / weak / mastered
- ✅ Spaced repetition: Leitner-box scheduling
  (30min → 4h → 1d → 3d → 7d → 14d → 30d)
- ✅ XP + Captain's Rank ladder (Deckhand → Captain, 750 XP each)
- ✅ Wind Streak with milestone bonuses (5/10/25/50)
- ✅ Daily missions (3 per day, resets at local midnight)
- ✅ 8 achievements: 3 topic-mastery + Knot Master + First Voyage +
  Fair Winds + Halfway Home + Chartered
- ✅ Readiness model uses coverage × mastery × recent accuracy × mock
  performance; capped at coverage floor

## Knoten

- ✅ All 9 practical exam knot skills, bilingual instructions
- ✅ SVG animation / practice framework
- ⚠ Rope paths **not** mechanically validated. Step-by-step text is
  factually correct (cross-checked with Ashley Book of Knots), but the
  drawn SVG is decorative rather than diagrammatic. See
  `KNOT_VALIDATION_STATUS` in `src/data/knots.ts`. Needs sailor/SBF
  instructor review before v1.3 is called truly complete.

## Crew — DEFERRED to Milestone F

- ⚠ Cloud backend (Supabase) — not implemented
- ⚠ Guest/local + cloud account path — only guest/local works
- ⚠ Crew create/join code — not implemented
- ⚠ Shared leaderboard — not implemented
- ⚠ Weekly XP / activity / accuracy / readiness / mock metrics —
  displayed locally, no shared view
- ⚠ Cross-device sync — not implemented (backup export/import works
  as a manual alternative)
- ⚠ Notes private — trivially true in local-only mode
- ⚠ Anti-cheat / server validation — N/A without server

**This is the biggest gap from the v1.3 spec.** Marking release as
**v1.3-rc.1 (Crew deferred)** rather than v1.3.0 until Milestone F ships.

## Release QA

- ✅ PWA installable (vite-plugin-pwa manifest generated)
- ✅ Offline functionality: 611 KB precache includes the full catalogue,
  so all study modes work offline
- ✅ Export / import: versioned JSON envelope, migrates from v1 and from
  the pre-refactor `sbfState` key on load
- ✅ Production Pages deployment: `.github/workflows/pages.yml` runs
  typecheck + tests + build + deploy on every push to main; every
  merged milestone PR has deployed successfully
- ✅ No "300/300" or "Exam Ready" claim until validation passes:
  the Bridge shows honest coverage badges; the Mock Exam gate opens
  only when translated + explained both reach 100%

## Testing

47 tests across 8 files, all green.

- catalogue integrity (6): count assertions, ID contiguity, answer
  shape, index-0 convention, nav templates, scenarios
- randomiser (6): permutation coverage, determinism, DE/EN mapping
  synchronisation, correctness of grading, inverse round-trip,
  non-trivial shuffling
- exam (3): mock generation counts, no duplicates, independent
  thresholds
- xp (5): rank ladder boundaries, cap at Captain, progress math
- coverage (4): empty state, full state, whitespace rejection,
  shipped catalogue populated
- learning (9): SRS state transitions, mastery derivation, interval
  growth, queue priority, bilge/bookmark filtering, mastery summary
- mockSession (3): readiness cap by coverage, mock-passed double
  weight, low-but-nonzero on empty state
- achievements (11): wind streak milestones, daily missions rollover
  and progress, topic mastery, catalogue milestones, knot master,
  first mock pass

## Ship criteria

- To ship as **v1.3-rc.1**: everything above passes. Crew is
  explicitly deferred to v1.3.0.
- To ship as **v1.3.0**: Milestone F (Crew backend) must also be
  complete, and the knot paths need mechanical review.

## Deployment

Merge this PR → Pages workflow runs → deploys to
https://vinayventures.github.io/SBF-See-Captain-Trainer/. No
additional steps required.

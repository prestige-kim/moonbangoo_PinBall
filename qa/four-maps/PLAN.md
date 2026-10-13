# Four maps local verification — preregistered before new-map trials

Start branch: `release-check/fairness-fix`; start HEAD: `78b23b4baf73a6b58203185c9a610c4443f4dc43`.
Baseline commit: `8362f84756a7083ce0d1f0201735563ec78adde1` on `codex/four-maps-local`.
Baseline preserves existing duration guidance, result home link and related QA sources. Excluded and preserved: `qa/fairness/freeze.cjs` (historical audit administration), `qa/fairness/results/confirm.json` and `.json.gz` (large prior audit results), `stitch-exports/*.zip` (original design references, ignored by existing rules). No original changes discarded. No push, PR, merge, deployment, or operating workflow changes authorized.

## Evidence and sampling

- Before new map trials: original geometry hash and B/C/D captured hand records saved in `tests/fixtures/classic-before-four-maps.json`. Exact ranks and finish times must remain equal.
- Per map development: two seeds at 1/2/6/50/200/500 balls, defaults and all eight radius8/16 × gravity350/1500 × restitution.35/.92 corners. Timeout 240 physics seconds; do not drop failures. Capture actual HandScene/ThrowGate hand starts at B(no extra mixing), C(2s circle), D(seed-driven varied gesture), and test exact replay.
- Fairness development: 40 seeds for each B/C/D per new map, names/groups fixed as red2/green2/blue2. Prefix `fourmaps-dev-fair-{map}-{protocol}-`. Used only to inspect bias and tune geometry.
- Freeze geometry before final check. Final fairness: 300 independent seeds per B/C/D per new map; prefix `fourmaps-final-fair-{map}-{protocol}-`. Never reuse final seeds for tuning. Report counts per ID/group/start-slot, group expectation by quantity, chi-square p, Wilson95% intervals. Screen p>=.01; maximum group/ID deviation <=1.5 percentage points reported against the prior audit criterion. This small sample is exploratory, insufficient to certify 1.5pp equivalence. A flagged final result stays flagged.
- Time/performance: 200 and 500 balls, at least 5 independent default runs per new map, per-step p50/p95, wall time, timeout and exceptions. Browser FPS is separate from headless CPU step timings.
- Geometry: no skills/rescue/portal/boost/bumper in new maps; last20% y8800..11000 remains broad and static. Entire moving cycle gaps >=96. Every boundary combination validated; no assertion that untested seeds must always finish.
- Browsers: real mouse pouring/mixing/exit/race/result; four maps; widths360/390/768/1280/1920; browser emulation explicitly distinguished from real handset. Capture screenshots and input-start records. Replay under visual quality/motion settings and different frame groupings. Check selection, persistence, restart, rules and early-stop unmet winners.

Duration targets (200/default/1x, excludes launch): twinfold30–50s, cascade40–65s, rhythm35–60s. Record misses honestly; do not force velocities or ranking to meet them.

## Development geometry revision before final samples

Twinfold v1's B pilot (40 seeds) flagged group p=.00050. Replace two outer entry guides with six short fixed sloping guides in two open rows (y920/1220); no identity-dependent behavior or force added. New twinfold geometry version2. Re-run its full matrix and hand/replay cases and the same development seed set. Final seeds remain unused.

## Geometric gap correction, independent of holdout statistics

A separate pairwise geometry audit found twinfold's extra bend bars only46/61/90 units from island boundaries, despite completion tests passing. Move and shorten those bars and move merge guides away from the side rails; version3. This correction is required by the >=96 geometric acceptance rule, not selected to fit final winner counts. Preserve v2 holdout results including its flagged D group result. Version3 uses fresh `fourmaps-final-v3-fair-twinfold-{B|C|D}-0000..0299` seeds, same300 samples and p / 1.5pp criteria. Never reuse v2 holdout seeds to tune or confirm. Re-run twinfold matrix, replay and browser flow. Cascade/rhythm geometry is unchanged.

The same explicit side-wall audit found cascade entry guides at x100/900 had only56 clear units to the rails. Move to x140/860 (96 clear units), preserving all18 shelves and their slopes; cascade version2. Preserve prior version1 holdout. New independent final prefix `fourmaps-final-v2-fair-cascade-`, same300 samples per protocol. Rhythm geometry passes the new all-pairs and wall clearance audit unchanged.

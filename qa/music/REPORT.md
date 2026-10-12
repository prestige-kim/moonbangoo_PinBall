# Licensed music release — 2026-10-13

Production baseline: db85b75. Four Kevin MacLeod recordings under CC BY 4.0.

## Verified behavior

- No media allocation before a positive-volume user gesture.
- Setup → mixing/flight → running → confirmed results → restart routes through the real controller.
- Early-stop results without confirmed winners stay silent.
- One reusable player, looping scene tracks and a 12-second one-shot result cue.
- Mute, volume zero and document visibility pause playback; returning resumes position.
- Web Audio gain supports music volume on mobile Safari without another media source per track.
- Local browser: start unlocks the looping Chipper Doodle v2 player (readyState 4), sound OFF pauses, and game start switches to Electrodoodle. No console errors in the final browser check.
- Public credits render all four titles, author, source, CC BY 4.0 links and editing notes.
- Deployed MP3 SHA-256 values match the source manifest. Result asset duration: 12.000 seconds.

## Existing baseline failures

Five checks were reproduced against a clean archive of db85b75 (with test fixture loading DisplayBudget and exposing setRenderScale to match the baseline controller):

- tests/camera-follow.test.cjs: leading marble stays inside usable view.
- tests/camera-follow.test.cjs: sustained empty board at 3x.
- tests/integration.test.cjs: slow shuffle quality fallback.
- tests/integration.test.cjs: pending quality fallback on restored preferences.
- tests/shuffle-styles.test.cjs: legacy `hand-` stylesheet revision expectation.

These checks fail without the music changes. Music does not change physics, camera or rendering quality policy.

## Final validation

`npm test`: 235 tests, 230 passed, 5 failed (all five baseline failures above), 0 canceled/skipped.
Music/audio/deployment focused checks: 15 passed; real-controller soundtrack routing checks: 2 passed.
`git diff --check`: clean. Final local browser media readyState 4 and no console errors.

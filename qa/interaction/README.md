# Interaction evidence

Historical paired render evidence: e48358f. After the approved physical circular-grab change, use `qa/circular-grab/browser.cjs` and its PLAN.md. The original paired-video generators require the e48358f checkout because their equal-solver assertion is no longer applicable to the new physical shuffle.

Baseline: 78b23b4 (unfinished fairness audit). The original checkout and its pending duration changes are untouched. `*-before.js` are immutable visual comparison fixtures; production never imports them. No fairness completion is claimed.

`node --test qa/interaction.test.cjs` verifies display-only changes against the baseline solver and race at 30/60/120Hz render cadences.
`node qa/interaction/browser.cjs` captures paired, deterministic scenes and checks actual mouse/touch flows locally.

Run in order:

```sh
npm run qa
node qa/interaction/invariants.cjs
node qa/interaction/browser.cjs
node qa/interaction/detail-browser.cjs
node qa/interaction/bars-video.cjs
node qa/interaction/contact-video.cjs
```

Chrome, Playwright and `/opt/homebrew/bin/ffmpeg` are used for local evidence. Browser flow completion fast-forwards the real 120Hz race solver; it does not replace the winner logic. `browser.cjs` also runs `layout-browser.cjs`, checking actual running layouts after the real pointer launch. The detail material/bar images capture the canvas bitmap directly, so UI overlays do not hide diagnostic pixels.

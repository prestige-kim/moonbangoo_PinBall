# Smooth music transitions — 2026-10-13

Baseline: 273b60c.

## Changes

- Scene tracks use equal-power crossfades with smoothstep endpoints rather than pausing and replacing the same player's source.
- Mixing/setup transitions last 1.6s, flight-to-running 1.25s, and result reveal 1.8s. Mixing and flight keep the same player and position.
- Incoming tracks start at zero gain; the outgoing track remains audible until the incoming play promise confirms readiness. A pending incoming player is not canceled when an earlier fade completes.
- Confirmed winners keep race music during the 1.25s result-reveal delay. Unconfirmed results fade to silence. Result music remains a one-shot cue.
- Rapid transitions reuse at most four cached media sources and begin at existing gains. The squared gain sum stays constant for a completed-to-completed crossfade; endpoints are eased.
- Mute/volume zero/tab hiding pause every deck and freeze transition progress. Returning resumes the same fade. Web Audio gains provide mobile volume control; HTML media volume is the fallback.
- MP3 assets remain unchanged. Public music credits, source manifest and music README disclose runtime crossfade processing and retain CC BY 4.0 attribution.

## Focused checks

Audio + real controller: 46 checks passed. Expanded crossfade suite: 9/9 passed, including slow-buffer and rapid-reversal cases.
Local browser observed both Chipper Doodle v2 and Electrodoodle playing during the transition, then Chipper paused/reset and Electrodoodle continuing. No console errors.

(function (P) {
  'use strict';
  // Coordinates are centered screen distances divided by the available short side S.
  const THRESHOLDS = Object.freeze({ travel: .18, boundary: .24, outwardSpeed: 1.4, windowMs: 100 });
  const valid = (x, y, time) => Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(time) && time >= 0;

  class ThrowGate {
    constructor() { this.cancel(); }
    begin(x, y, timeMs) {
      this.cancel();
      if (!valid(x, y, timeMs)) return false;
      this.active = true; this.fired = false;
      this.start = { x, y, time: timeMs };
      this.samples = [{ x, y, time: timeMs }];
      return true;
    }
    move(x, y, timeMs) {
      if (!this.active || !valid(x, y, timeMs)) return false;
      const last = this.samples[this.samples.length - 1];
      if (timeMs < last.time) return false;
      const next = { x, y, time: timeMs };
      // Repeated timestamps provide one position, never an infinite event velocity.
      if (timeMs === last.time) this.samples[this.samples.length - 1] = next;
      else this.samples.push(next);
      // Keep one sample before the velocity window for exact linear interpolation.
      const cutoff = timeMs - THRESHOLDS.windowMs;
      while (this.samples.length > 2 && this.samples[1].time < cutoff) this.samples.shift();
      return true;
    }
    positionAt(timeMs) {
      const first = this.samples[0];
      // Before begin, the hand was stationary at its first observed position.
      if (timeMs <= first.time) return first;
      for (let i = 1; i < this.samples.length; i++) {
        const next = this.samples[i];
        if (timeMs > next.time) continue;
        const prior = this.samples[i - 1];
        const amount = (timeMs - prior.time) / (next.time - prior.time);
        return { x: prior.x + (next.x - prior.x) * amount, y: prior.y + (next.y - prior.y) * amount };
      }
      // A virtual stationary endpoint ages out a past flick, without adding events.
      return this.samples[this.samples.length - 1];
    }
    evaluate(timeMs) {
      const last = this.samples.length ? this.samples[this.samples.length - 1] : { x: 0, y: 0, time: 0 };
      const distance = this.start ? Math.hypot(last.x - this.start.x, last.y - this.start.y) : 0;
      const radius = Math.hypot(last.x, last.y);
      if (!this.active || !Number.isFinite(timeMs) || timeMs < 0) {
        return { eligible: false, distance, radius, outwardSpeed: 0, dx: 0, dy: 0 };
      }
      const now = Math.max(last.time, timeMs), before = this.positionAt(now - THRESHOLDS.windowMs);
      const dx = last.x - before.x, dy = last.y - before.y;
      const projection = radius > 0 ? (dx * last.x + dy * last.y) / radius : 0;
      const radialGrowth = radius - Math.hypot(before.x, before.y);
      // Require actual radial growth as well as outward projection. A fast arc at
      // fixed radius has an outward chord projection but is not an outward throw.
      const outwardSpeed = now > this.start.time
        ? Math.max(0, Math.min(projection, radialGrowth)) * 1000 / THRESHOLDS.windowMs : 0;
      return {
        eligible: distance >= THRESHOLDS.travel && radius > THRESHOLDS.boundary && outwardSpeed >= THRESHOLDS.outwardSpeed,
        distance, radius, outwardSpeed, dx, dy
      };
    }
    release(x, y, timeMs) {
      if (!this.active) return Object.assign(this.evaluate(timeMs), { fired: false });
      if (!this.move(x, y, timeMs)) {
        this.cancel(); return Object.assign(this.evaluate(timeMs), { fired: false });
      }
      const result = this.evaluate(timeMs);
      this.active = false; this.fired = result.eligible;
      return Object.assign(result, { fired: this.fired });
    }
    cancel() { this.active = false; this.fired = false; this.start = null; this.samples = []; }
  }
  P.THROW_THRESHOLDS = THRESHOLDS;
  P.ThrowGate = ThrowGate;
})(window.CosmicPinball = window.CosmicPinball || {});

(function (P) {
  'use strict';
  // Distances use the usable screen's short side S. Crossing the wall consumes a gesture immediately. Speed only affects flight.
  const THRESHOLDS = Object.freeze({ edgeBand: .14, corner: .10, approach: .12, windowMs: 160 });
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const valid = (x, y, time) => Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(time) && time >= 0;
  function bounds(area) {
    const usable = area && area.s > 0 && Number.isFinite(area.w) && Number.isFinite(area.h);
    return { halfWidth: usable ? (area.w / 2 - 16) / area.s : .5,
      halfHeight: usable ? (area.h / 2 - 24) / area.s : .5 };
  }
  function signed(x, y, frame, band) {
    const hw = Math.max(.1, frame.halfWidth - band), hh = Math.max(.1, frame.halfHeight - band);
    const r = Math.min(THRESHOLDS.corner, hw, hh);
    const qx = Math.abs(x) - hw + r, qy = Math.abs(y) - hh + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  }
  function edgePoint(dx, dy, frame) {
    let low = 0, high = Math.hypot(frame.halfWidth, frame.halfHeight) + 1;
    for (let i = 0; i < 24; i++) {
      const middle = (low + high) / 2;
      if (signed(dx * middle, dy * middle, frame, THRESHOLDS.edgeBand) < 0) low = middle;
      else high = middle;
    }
    return { x: dx * high, y: dy * high };
  }
  class ThrowGate {
    constructor() { this.cancel(); }
    begin(x, y, timeMs, area) {
      this.cancel();
      if (!valid(x, y, timeMs)) return false;
      this.bounds = bounds(area); this.active = true;
      this.insideSeen = signed(x, y, this.bounds, THRESHOLDS.edgeBand) <= 0;
      this.start = { x, y, time: timeMs }; this.samples = [{ x, y, time: timeMs }];
      return true;
    }
    move(x, y, timeMs, interacted = false) {
      if (!this.active || !valid(x, y, timeMs)) return false;
      const last = this.samples[this.samples.length - 1];
      if (timeMs < last.time || (timeMs === last.time && (x !== last.x || y !== last.y))) return false;
      const next = { x, y, time: timeMs };
      if (timeMs === last.time) this.samples[this.samples.length - 1] = next;
      else this.samples.push(next);
      const cutoff = timeMs - THRESHOLDS.windowMs;
      while (this.samples.length > 2 && this.samples[1].time < cutoff) this.samples.shift();
      this.interacted = this.interacted || interacted === true;
      this.distance = Math.max(this.distance, Math.hypot(x - this.start.x, y - this.start.y));
      if (signed(x, y, this.bounds, THRESHOLDS.edgeBand) <= 0) this.insideSeen = true;
      return true;
    }
    positionAt(timeMs) {
      const first = this.samples[0];
      if (timeMs <= first.time) return first;
      for (let i = 1; i < this.samples.length; i++) {
        const next = this.samples[i]; if (timeMs > next.time) continue;
        const prior = this.samples[i - 1], amount = (timeMs - prior.time) / (next.time - prior.time);
        return { x: prior.x + (next.x - prior.x) * amount, y: prior.y + (next.y - prior.y) * amount };
      }
      return this.samples[this.samples.length - 1];
    }
    evaluate(timeMs) {
      const last = this.samples.length ? this.samples[this.samples.length - 1] : { x: 0, y: 0, time: 0 };
      const radius = Math.hypot(last.x, last.y), dx = radius > 1e-8 ? last.x / radius : 1, dy = radius > 1e-8 ? last.y / radius : 0;
      const now = Math.max(last.time, Number.isFinite(timeMs) ? timeMs : last.time);
      const before = this.active ? this.positionAt(now - THRESHOLDS.windowMs) : last;
      const inputSpeed = Math.hypot(last.x - before.x, last.y - before.y) * 1000 / THRESHOLDS.windowMs;
      const qualified = this.active && this.interacted && this.insideSeen;
      const proximity = signed(last.x, last.y, this.bounds, THRESHOLDS.edgeBand);
      const edge = edgePoint(dx, dy, this.bounds);
      return { eligible: !!(qualified && proximity > 1e-9), distance: this.distance, radius, interacted: this.interacted,
        approach: qualified ? clamp(1 + proximity / THRESHOLDS.approach, 0, 1) : 0,
        dx, dy, edgeX: edge.x, edgeY: edge.y, inputSpeed };
    }
    takeExit(timeMs) {
      const result = this.evaluate(timeMs);
      if (result.eligible) { this.active = false; this.fired = true; }
      return Object.assign(result, { fired: result.eligible });
    }
    release(x, y, timeMs, interacted = false) {
      if (!this.active) return Object.assign(this.evaluate(timeMs), { fired: false });
      if (!this.move(x, y, timeMs, interacted)) { this.cancel(); return Object.assign(this.evaluate(timeMs), { fired: false }); }
      const result = this.takeExit(timeMs); this.active = false;
      return result;
    }
    cancel() {
      this.active = false; this.fired = false; this.insideSeen = false; this.interacted = false;
      this.distance = 0; this.start = null; this.samples = []; this.bounds = bounds();
    }
  }
  P.THROW_THRESHOLDS = THRESHOLDS;
  P.EDGE_GEOMETRY = Object.freeze({ bounds, signed });
  P.ThrowGate = ThrowGate;
})(window.CosmicPinball = window.CosmicPinball || {});

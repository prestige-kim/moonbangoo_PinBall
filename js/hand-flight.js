(function (P) {
  'use strict';
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const ease = value => { const t = clamp(value); return t * t * t * (10 + t * (-15 + t * 6)); };
  const interval = (from, to, value) => smooth((value - from) / (to - from));
  const lerp = (a, b, t) => a + (b - a) * t;
  const point = (matrix, x, y) => ({ x: matrix.a * x + matrix.e, y: matrix.d * y + matrix.f });
  const centroid = items => ({ x: items.reduce((sum, item) => sum + item.x, 0) / items.length,
    y: items.reduce((sum, item) => sum + item.y, 0) / items.length });
  function curve(from, velocity, target, duration, q) {
    const delta = target - from, tangent = velocity * duration;
    const a = 10 * delta - 6 * tangent, b = -15 * delta + 8 * tangent, c = 6 * delta - 3 * tangent;
    return { position: from + tangent * q + a * q * q * q + b * q * q * q * q + c * q * q * q * q * q,
      velocity: (tangent + 3 * a * q * q + 4 * b * q * q * q + 5 * c * q * q * q * q) / duration };
  }

  class HandFlight {
    constructor(cinematic) { this.cinema = cinematic; this.items = []; this.lastPoses = []; }
    begin(physics, handScene, decision, duration = 2.8, reduced = false) {
      const c = this.cinema, area = handScene.area(), camera = handScene.camera || c.camera;
      this.area = Object.assign({}, area); this.duration = Math.max(.25, Number(duration) || 2.8); this.reduced = !!reduced;
      this.physics = physics;
      // Even a stationary ready release launches. Input speed only adds visual
      // thrust. Landing coordinates were already captured from the real shuffle.
      const speed = Math.min(2.8, Math.max(0, Number(decision && decision.inputSpeed) || 0));
      this.propulsion = area.s * (this.reduced ? .12 : .8 + speed * .1);
      const origin = camera ? camera.worldToScreen(0, 0) : { x: area.w / 2 - 500 * .5, y: area.h / 2 - 450 * .5 };
      const zoom = camera && camera.zoom || .5;
      this.final = { a: zoom, b: 0, c: 0, d: zoom, e: origin.x, f: origin.y };
      this.landingFinal = Object.assign({}, this.final); this.correction = null;
      const scale = Math.min(area.s * .32 / 1000, area.h * .7 / 2200);
      this.initial = this.reduced ? Object.assign({}, this.final)
        : { a: scale, b: 0, c: 0, d: scale, e: area.w + area.s * .15, f: area.h * .32 };
      this.bottom = P.CINEMA && P.CINEMA.boardView && camera
        ? P.CINEMA.boardView(area.w, area.h, camera, 0, false).bottom : 2200;
      let dx = Number(decision && decision.dx) || 0, dy = Number(decision && decision.dy) || 0;
      const length = Math.hypot(dx, dy);
      if (length > 1e-10) { dx /= length; dy /= length; } else { dx = 1; dy = 0; }
      this.direction = { x: dx, y: dy };
      const bodies = new Map(handScene.shuffle.bodies.map(body => [body.id, body]));
      const marbles = new Map(physics.marbles.map(marble => [marble.id, marble]));
      this.items = handScene.entries.map((entry, index) => {
        const body = bodies.get(entry.id), marble = marbles.get(entry.id);
        if (!body || !marble) throw new Error('비행 핀볼 ID가 셔플 또는 경기 출발 슬롯과 일치하지 않습니다.');
        const displayScale = area.s * (handScene.viewScale || 1);
        const source = { id: entry.id, index, entry, x: area.x + body.x * displayScale, y: area.y + body.y * displayScale,
          vx: body.vx * displayScale, vy: body.vy * displayScale, radius: body.r * displayScale, delay: 0 };
        const target = point(this.initial, marble.x, marble.y);
        return Object.assign(source, { targetX: target.x, targetY: target.y, endRadius: marble.r * this.initial.a, marble });
      });
      const front = this.items.slice().sort((a, b) => (b.x * dx + b.y * dy) - (a.x * dx + a.y * dy) || a.index - b.index);
      const maxDelay = Math.min(.12, this.duration * .15);
      front.forEach((item, rank) => { item.delay = front.length > 1 ? rank / (front.length - 1) * maxDelay : 0; });
      this.releaseCenter = centroid(this.items);
      this.targetCenter = centroid(this.items.map(item => ({ x: item.targetX, y: item.targetY })));
      const worldCenter = centroid(this.items.map(item => ({ x: item.marble.x, y: item.marble.y })));
      this.finalCenter = point(this.final, worldCenter.x, worldCenter.y);
      this.lastPoses = [];
      return this;
    }
    pose(index, seconds) {
      const item = this.items[index];
      if (!item) return null;
      const time = Math.max(0, Number(seconds) || 0), p = clamp(time / this.duration);
      const radius = lerp(item.radius, item.endRadius, smooth(p));
      if (time >= this.duration) return { id: item.id, index, x: item.targetX, y: item.targetY, vx: 0, vy: 0,
        radius: item.endRadius, focus: 1, amount: 1, depth: 0 };
      if (time <= item.delay) return { id: item.id, index, x: item.x + item.vx * time, y: item.y + item.vy * time,
        vx: item.vx, vy: item.vy, radius, focus: 1, amount: p, depth: 0 };
      const duration = this.duration - item.delay, q = (time - item.delay) / duration;
      const x = curve(item.x + item.vx * item.delay, item.vx, item.targetX, duration, q);
      const y = curve(item.y + item.vy * item.delay, item.vy, item.targetY, duration, q);
      const amplitude = this.propulsion;
      // The impulse envelope has zero first and second derivatives at both ends.
      // It uses the actual release direction and starts only after the front delay.
      const bump = amplitude * 64 * q * q * q * Math.pow(1 - q, 3);
      const bumpVelocity = amplitude * 192 * q * q * Math.pow(1 - q, 2) * (1 - 2 * q) / duration;
      return { id: item.id, index, x: x.position + this.direction.x * bump, y: y.position + this.direction.y * bump,
        vx: x.velocity + this.direction.x * bumpVelocity, vy: y.velocity + this.direction.y * bumpVelocity,
        radius, focus: 1, amount: p, depth: 0 };
    }
    correctionAt(progress) {
      const track = this.correction;
      if (!track) return { logScale: 0, e: 0, f: 0, vLog: 0, vE: 0, vF: 0 };
      const duration = 1 - track.start, p = clamp(progress);
      if (p >= 1 || duration <= 0) return Object.assign({}, track.target, { vLog: 0, vE: 0, vF: 0 });
      if (p <= track.start) return track.from;
      const q = (p - track.start) / duration;
      const scale = curve(track.from.logScale, track.from.vLog, track.target.logScale, duration, q);
      const x = curve(track.from.e, track.from.vE, track.target.e, duration, q);
      const y = curve(track.from.f, track.from.vF, track.target.f, duration, q);
      return { logScale: scale.position, e: x.position, f: y.position,
        vLog: scale.velocity, vE: x.velocity, vF: y.velocity };
    }
    retarget(camera, progress) {
      if (!camera || !this.landingFinal) return false;
      const origin = camera.worldToScreen(0, 0), zoom = camera.zoom;
      if (!(zoom > 0) || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return false;
      const next = { a: zoom, b: 0, c: 0, d: zoom, e: origin.x, f: origin.y };
      if (['a','d','e','f'].every(key => Math.abs(next[key] - this.landingFinal[key]) < 1e-10)) return false;
      const p = clamp(Number(progress) || 0), scale = zoom / this.final.a;
      // A viewport change adjusts the shared camera over the remaining flight.
      // Keep every source, own slot and trajectory fixed, including their IDs.
      // Carry correction velocity too, so another resize cannot abruptly stop it.
      this.correction = { start: p, from: this.correctionAt(p),
        target: { logScale: Math.log(scale), e: origin.x - scale * this.final.e, f: origin.y - scale * this.final.f } };
      this.landingFinal = next;
      return true;
    }
    cameraAt(progress, samples) {
      const p = clamp(Number(progress) || 0), amount = this.reduced ? 0 : ease(p);
      let scene = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
      if (!this.reduced) {
        const desired = Math.exp(Math.log(.66) * ease(p / .25)
          + Math.log(this.final.a / this.initial.a / .66) * ease((p - .65) / .35));
        const poses = samples || this.items.map((_, index) => this.pose(index, p * this.duration));
        let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity, sumX = 0, sumY = 0;
        for (const pose of poses) {
          left = Math.min(left, pose.x - pose.radius); right = Math.max(right, pose.x + pose.radius);
          top = Math.min(top, pose.y - pose.radius); bottom = Math.max(bottom, pose.y + pose.radius);
          sumX += pose.x; sumY += pose.y;
        }
        const fit = Math.min(this.area.w * .82 / Math.max(1, right - left), this.area.h * .72 / Math.max(1, bottom - top));
        const limit = Math.exp(Math.log(fit) * ease(p / .22));
        const wide = Math.min(desired, limit);
        const scale = Math.exp(lerp(Math.log(wide), Math.log(desired), ease((p - .8) / .2)));
        const center = { x: (left + right) / 2, y: (top + bottom) / 2 };
        const frame = { x: this.area.w / 2, y: this.area.h / 2 };
        const enter = ease((p - .72) / .28);
        const focus = { x: lerp(lerp(this.releaseCenter.x, frame.x, interval(0, .22, p)), this.finalCenter.x, enter),
          y: lerp(lerp(this.releaseCenter.y, frame.y, interval(0, .22, p)), this.finalCenter.y, enter) };
        const mean = { x: sumX / poses.length, y: sumY / poses.length };
        const movingCenter = { x: lerp(center.x, mean.x, enter), y: lerp(center.y, mean.y, enter) };
        const pan = interval(0, .22, p);
        scene = { a: scale, b: 0, c: 0, d: scale,
          e: (focus.x - scale * movingCenter.x) * pan, f: (focus.y - scale * movingCenter.y) * pan };
      }
      const correction = this.correctionAt(p), correctionScale = Math.exp(correction.logScale);
      scene = { a: correctionScale * scene.a, b: 0, c: 0, d: correctionScale * scene.d,
        e: correctionScale * scene.e + correction.e, f: correctionScale * scene.f + correction.f };
      // Exact final matrix avoids rounding error at the sprite/physics handoff.
      if (p === 1) scene = { a: this.landingFinal.a / this.initial.a, b: 0, c: 0, d: this.landingFinal.d / this.initial.d,
        e: this.landingFinal.e - this.initial.e * this.landingFinal.a / this.initial.a,
        f: this.landingFinal.f - this.initial.f * this.landingFinal.d / this.initial.d };
      const current = { a: scene.a * this.initial.a, b: 0, c: 0, d: scene.d * this.initial.d,
        e: scene.a * this.initial.e + scene.e, f: scene.d * this.initial.f + scene.f };
      return Object.assign({}, scene, { scene, initial: this.initial, current, final: this.landingFinal, bottom: this.bottom,
        amount, scale: scene.a });
    }
    render(state) {
      const c = this.cinema; c.resize();
      const ctx = c.ctx, w = c.width, h = c.height, p = clamp(Number(state.progress) || 0);
      this.retarget(state.camera, p);
      const samples = p === 1 ? null : this.items.map((_, index) => this.pose(index, p * this.duration));
      const view = this.cameraAt(p, samples), reduced = state.reducedMotion === undefined ? this.reduced : !!state.reducedMotion;
      const physics = state.physics || this.physics, camera = state.camera;
      ctx.clearRect(0, 0, w, h);
      if (p === 1 && camera) {
        const marbles = new Map(physics.marbles.map(marble => [marble.id, marble]));
        this.lastPoses = this.items.map(item => {
          const marble = marbles.get(item.id), target = camera.worldToScreen(marble.x, marble.y);
          const pose = { id: item.id, index: item.index, x: target.x, y: target.y, radius: marble.r * camera.zoom, focus: 1 };
          c.drawOrb(item.entry, pose, 1, marble, this.items.length, reduced); return pose;
        });
        return { reveal: 1, cameraAmount: 1 };
      }
      const background = ctx.createLinearGradient(0, 0, w, h);
      background.addColorStop(0, '#faf6eb'); background.addColorStop(.57, '#f2e9d6'); background.addColorStop(1, '#e9dec7');
      ctx.fillStyle = background; ctx.fillRect(0, 0, w, h);
      ctx.save(); ctx.transform(view.a, 0, 0, view.d, view.e, view.f);
      c.targetBoard(view, physics, 1, 'flight');
      this.lastPoses = this.items.map((item, index) => {
        const pose = samples[index];
        c.drawOrb(item.entry, pose, interval(.55, 1, p), item.marble, this.items.length, reduced);
        const screen = point(view.scene, pose.x, pose.y);
        return { id: pose.id, index, x: screen.x, y: screen.y, radius: pose.radius * view.a, focus: 1 };
      });
      ctx.restore();
      return { reveal: interval(.72, 1, p), cameraAmount: view.amount };
    }
  }
  P.HandFlight = HandFlight;
})(window.CosmicPinball = window.CosmicPinball || {});

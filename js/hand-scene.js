(function (P) {
  'use strict';
  class HandScene {
    constructor(cinematic) { this.cinema = cinematic; this.shuffle = null; }
    area() {
      this.cinema.resize();
      const w = this.cinema.width, h = this.cinema.height;
      return { x: w / 2, y: h / 2, s: Math.max(1, Math.min(w - 32, h - 48)), w, h };
    }
    begin(physics) {
      const c = this.cinema, entries = c.entries(physics), area = this.area();
      const views = P.CINEMA.matchedViews(area.w, area.h, 0, 0);
      this.sources = entries.map(entry => {
        const pose = P.CINEMA.project(c.chamber.pose(entry.index), views.front, views.angle, 0);
        return { x: (pose.x - area.x) / area.s, y: (pose.y - area.y) / area.s,
          r: views.frame.thickness * .42 * c.chamber.radius / area.s };
      });
      this.entries = entries;
      this.shuffle = new P.HandShuffle(entries, physics.seed);
      this.elapsed = 0; this.accumulator = 0; this.launchDecision = null;
    }
    update(dt) {
      this.elapsed += dt;
      if (this.elapsed < .8) return;
      this.accumulator = Math.min(.05, this.accumulator + dt);
      const area = this.area();
      this.shuffle.bounds = { left: (-area.w / 2 + 16) / area.s, right: (area.w / 2 - 16) / area.s,
        top: (-area.h / 2 + 24) / area.s, bottom: (area.h / 2 - 24) / area.s };
      while (this.accumulator >= 1 / 120) { this.shuffle.step(1 / 120); this.accumulator -= 1 / 120; }
    }
    render(state) {
      const c = this.cinema, ctx = c.ctx, area = this.area(), t = P.CINEMA.easeCamera(this.elapsed / .8);
      ctx.clearRect(0, 0, area.w, area.h);
      const bg = ctx.createLinearGradient(0, 0, area.w, area.h);
      bg.addColorStop(0, '#faf6eb'); bg.addColorStop(.57, '#f2e9d6'); bg.addColorStop(1, '#e9dec7');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, area.w, area.h);
      if (t < 1) {
        const views = P.CINEMA.matchedViews(area.w, area.h, 0, 0);
        c.drawPlate('front', views.front, 1 - t);
      }
      if (t === 1 && this.gate) {
        const feedback = this.gate.evaluate(performance.now());
        ctx.beginPath(); ctx.arc(area.x, area.y, P.THROW_THRESHOLDS.boundary * area.s, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(158,126,76,.20)'; ctx.lineWidth = 1.2; ctx.stroke();
        if (feedback.eligible) {
          const angle = Math.atan2(feedback.dy, feedback.dx);
          ctx.save(); ctx.beginPath(); ctx.arc(area.x, area.y, P.THROW_THRESHOLDS.boundary * area.s, angle - .38, angle + .38);
          ctx.strokeStyle = '#c9a24f'; ctx.lineWidth = 3; ctx.lineCap = 'round';
          if (!state.reducedMotion) { ctx.shadowColor = '#e7c77b'; ctx.shadowBlur = 8; }
          ctx.stroke(); ctx.restore();
        }
        c.canvas.dataset.throwReady = String(feedback.eligible);
      }
      this.lastPoses = this.shuffle.bodies.map((body, i) => {
        const start = this.sources[i];
        const pose = { id: body.id, x: area.x + (start.x * (1-t) + body.x * t) * area.s,
          y: area.y + (start.y * (1-t) + body.y * t) * area.s,
          radius: (start.r * (1-t) + body.r * t) * area.s, focus: 1 };
        c.drawOrb(this.entries[i], pose, 0, state.physics.marbles[i], this.entries.length, state.reducedMotion);
        if (this.entries.length <= 16 && t === 1) c.drawLabel(this.entries[i], pose.x, pose.y, pose.radius, .68);
        return pose;
      });
      if (t === 1 && this.shuffle.pointer) {
        const pointer = this.shuffle.pointer, x = area.x + pointer.x * area.s, y = area.y + pointer.y * area.s;
        const radius = this.shuffle.pointerRadius * area.s;
        const field = ctx.createRadialGradient(x, y, 0, x, y, radius);
        field.addColorStop(0, 'rgba(174,145,91,.09)'); field.addColorStop(1, 'rgba(174,145,91,0)');
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = field; ctx.fill(); ctx.strokeStyle = 'rgba(158,126,76,.18)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      }
      if (t === 1) {
        ctx.fillStyle = '#8a7760'; ctx.font = '12px "Pretendard Variable", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('섞어서 바깥으로 던져 주세요', area.x, area.y + .38 * area.s);
      }
      if (c.canvas.dataset) c.canvas.dataset.handPhase = this.elapsed < .8 ? 'emerging' : this.shuffle.pointer ? 'dragging' : 'settling';
      c.lastStage = 'mixing';
      return { reveal: 0 };
    }
  }
  P.HandScene = HandScene;
})(window.CosmicPinball = window.CosmicPinball || {});

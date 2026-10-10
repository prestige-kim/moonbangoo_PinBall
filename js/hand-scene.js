(function (P) {
  'use strict';
  class HandScene {
    constructor(cinematic) { this.cinema = cinematic; this.shuffle = null; }
    // A shared visual camera pulls back during extraction, then stays steady
    // under the hand. Physics and edge readiness keep their original units.
    get viewScale() { return 1 - .16 * P.CINEMA.easeCamera(this.elapsed / .8); }
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
      this.elapsed = 0; this.accumulator = 0; this.launchDecision = null; this.edgeGlow = 0;
    }
    update(dt) {
      this.elapsed += dt;
      const feedback = this.gate && this.gate.evaluate(performance.now());
      const target = feedback ? (feedback.eligible ? 1 : feedback.approach * .65) : 0;
      this.edgeGlow += (target - this.edgeGlow) * Math.min(1, dt * 9);
      if (this.elapsed < .8) return;
      this.accumulator = Math.min(.05, this.accumulator + dt);
      const area = this.area(), zoom = this.viewScale;
      const frame = P.EDGE_GEOMETRY.bounds(area), edge = P.THROW_THRESHOLDS.edgeBand;
      const halfWidth = Math.max(.1, frame.halfWidth - edge), halfHeight = Math.max(.1, frame.halfHeight - edge);
      this.shuffle.bounds = { left: -halfWidth / zoom, right: halfWidth / zoom,
        top: -halfHeight / zoom, bottom: halfHeight / zoom,
        cornerRadius: Math.min(P.THROW_THRESHOLDS.corner, halfWidth, halfHeight) / zoom,
        opening: P.EDGE_GEOMETRY.opening(frame).span / zoom,
        outer: { left: -frame.halfWidth / zoom, right: frame.halfWidth / zoom, top: -frame.halfHeight / zoom, bottom: frame.halfHeight / zoom } };
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
        const thresholds = P.THROW_THRESHOLDS, band = thresholds.edgeBand * area.s, radius = thresholds.corner * area.s;
        const feedback = this.gate.evaluate(performance.now());
        const mouth = P.EDGE_GEOMETRY.opening(P.EDGE_GEOMETRY.bounds(area));
        const left = 16 + band, right = area.w - 16 - band, top = 24 + band, bottom = area.h - 24 - band;
        const span = mouth.span * area.s, r = Math.min(radius, (right-left)/2, (bottom-top)/2);
        const wallPath = () => {
          ctx.beginPath(); ctx.moveTo(right-span, top); ctx.lineTo(left+r, top);
          ctx.quadraticCurveTo(left,top,left,top+r); ctx.lineTo(left,bottom-r);
          ctx.quadraticCurveTo(left,bottom,left+r,bottom); ctx.lineTo(right-r,bottom);
          ctx.quadraticCurveTo(right,bottom,right,bottom-r); ctx.lineTo(right,top+span);
        };
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // A continuous warm rail closes three corners. Its only break is the
        // same diagonal outlet used by the collision walls and input gate.
        wallPath(); ctx.strokeStyle = '#c6b38f'; ctx.lineWidth = Math.max(7, Math.min(13, .022 * area.s));
        ctx.shadowColor = 'rgba(89,68,35,.18)'; ctx.shadowBlur = state.reducedMotion ? 0 : 7; ctx.stroke();
        ctx.shadowBlur = 0; wallPath(); ctx.strokeStyle = '#eee3cd'; ctx.lineWidth = Math.max(3, Math.min(7, .012 * area.s)); ctx.stroke();
        const qualified = this.gate.active && feedback.interacted && this.gate.insideSeen;
        const alpha = qualified ? Math.max(this.edgeGlow, feedback.approach * .65) : 0;
        const x = area.x + mouth.x * area.s, y = area.y + mouth.y * area.s;
        const dx = Math.SQRT1_2, dy = -Math.SQRT1_2;
        ctx.strokeStyle = feedback.eligible ? '#c9a24f' : '#ad8a45'; ctx.lineWidth = 2 + alpha;
        if (!state.reducedMotion && alpha > .01) { ctx.shadowColor = '#e7c77b'; ctx.shadowBlur = feedback.eligible ? 8 : 3; }
        ctx.beginPath();
        ctx.moveTo(right-span-.024*area.s,top); ctx.lineTo(right-span,top);
        ctx.moveTo(right,top+span); ctx.lineTo(right,top+span+.024*area.s); ctx.stroke();
        const length = .036 * area.s, head = .018 * area.s;
        const ax = x + dx * .045 * area.s, ay = y + dy * .045 * area.s;
        ctx.beginPath(); ctx.moveTo(ax-dx*length,ay-dy*length); ctx.lineTo(ax+dx*length,ay+dy*length);
        ctx.moveTo(ax+dx*length-dx*head+dy*head,ay+dy*length-dy*head-dx*head);
        ctx.lineTo(ax+dx*length,ay+dy*length);
        ctx.lineTo(ax+dx*length-dx*head-dy*head,ay+dy*length-dy*head+dx*head); ctx.stroke();
        ctx.restore();
        c.canvas.dataset.throwReady = String(feedback.eligible);
      }
      this.lastPoses = this.shuffle.bodies.map((body, i) => {
        const start = this.sources[i];
        const pose = { id: body.id, x: area.x + (start.x * (1-t) + body.x * t * this.viewScale) * area.s,
          y: area.y + (start.y * (1-t) + body.y * t * this.viewScale) * area.s,
          radius: (start.r * (1-t) + body.r * t * this.viewScale) * area.s, focus: 1 };
        c.drawOrb(this.entries[i], pose, 0, state.physics.marbles[i], this.entries.length, state.reducedMotion);
        if (this.entries.length <= 16 && t === 1) c.drawLabel(this.entries[i], pose.x, pose.y, pose.radius, .68);
        return pose;
      });
      if (t === 1 && this.shuffle.pointer) {
        const pointer = this.shuffle.pointer, x = area.x + pointer.x * area.s * this.viewScale, y = area.y + pointer.y * area.s * this.viewScale;
        const radius = this.shuffle.pointerRadius * area.s * this.viewScale;
        const field = ctx.createRadialGradient(x, y, 0, x, y, radius);
        field.addColorStop(0, 'rgba(174,145,91,.09)'); field.addColorStop(1, 'rgba(174,145,91,0)');
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = field; ctx.fill(); ctx.strokeStyle = 'rgba(158,126,76,.18)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      }
      if (t === 1) {
        ctx.fillStyle = '#8a7760'; ctx.font = '12px "Pretendard Variable", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('우측 상단 출구로 공을 끌어 주세요', area.x, area.y + .38 * area.s);
      }
      if (c.canvas.dataset) c.canvas.dataset.handPhase = this.elapsed < .8 ? 'emerging' : this.shuffle.pointer ? 'dragging' : 'settling';
      c.lastStage = 'mixing';
      return { reveal: 0 };
    }
  }
  P.HandScene = HandScene;
})(window.CosmicPinball = window.CosmicPinball || {});

(function (P) {
  'use strict';
  const clamp = value => Math.max(0, Math.min(1, value));
  const mix = (a, b, t) => a + (b - a) * t;
  // Seconds, independent of render frame count. Reduced motion keeps the same
  // ID handoff and collision simulation, with a smaller camera/tube movement.
  const POUR = { duration: 3.15, tilt: .65, firstRelease: .72, releaseSpan: 1.25, roll: .48, fall: .65, gravity: .72, withdraw: 2.65 };
  class HandScene {
    constructor(cinematic) { this.cinema = cinematic; this.shuffle = null; }
    // A shared visual camera pulls back during extraction, then stays steady
    // under the hand. Physics and edge readiness keep their original units.
    get viewScale() { return 1 - .16 * P.CINEMA.easeCamera(this.elapsed / POUR.tilt); }
    get ready() { return this.elapsed >= POUR.duration && this.remaining === 0; }
    area() {
      this.cinema.resize();
      const w = this.cinema.width, h = this.cinema.height;
      return { x: w / 2, y: h / 2, s: Math.max(1, Math.min(w - 32, h - 48)), w, h };
    }
    begin(physics, reducedMotion = false) {
      const c = this.cinema, entries = c.entries(physics);
      this.sources = entries.map(entry => ({ ...c.chamber.pose(entry.index) }));
      this.entries = entries;
      this.shuffle = new P.HandShuffle(entries, physics.seed);
      // Queue ownership is visual only: never reorder entries, race marbles or
      // seeded starting slots. The balls nearest the mouth roll out first.
      const order = entries.map((entry, i) => i).sort((a, b) => this.sources[b].x - this.sources[a].x || a - b);
      this.pours = new Array(entries.length);
      this.arrivals = order; this.nextArrival = 0;
      order.forEach((i, rank) => {
        const body = this.shuffle.bodies[i];
        const release = POUR.firstRelease + POUR.releaseSpan * rank / Math.max(1, entries.length - 1);
        const arrival = Math.ceil((release + POUR.fall) * 120) / 120;
        this.pours[i] = { release, arrival };
        body.pouring = true;
      });
      // Freeze choreography parameters for this pour. Toggling the setting
      // later cannot restart the clock or jump the current positions.
      this.pourReduced = !!reducedMotion;
      this.geometry = null; this.remaining = entries.length;
      this.elapsed = 0; this.simulationTicks = 0; this.accumulator = 0;
      this.launchDecision = null; this.edgeGlow = 0;
    }
    views(area) {
      if (!this.geometry || this.geometry.w !== area.w || this.geometry.h !== area.h) {
        this.geometry = { w: area.w, h: area.h, views: P.CINEMA.matchedViews(area.w, area.h, 0, 0) };
        this.pours.forEach(pour => { pour.path = null; });
      }
      return this.geometry.views;
    }
    rigAt(time, area) {
      const frame = this.views(area).frame;
      const lift = P.CINEMA.easeCamera(time / POUR.tilt);
      const leave = P.CINEMA.easeCamera((time - POUR.withdraw) / (POUR.duration - POUR.withdraw));
      const length = mix(frame.length / area.s, .40, lift);
      const rotation = mix(frame.rotation, this.pourReduced ? .26 : .40, lift);
      return { x: mix((frame.x - area.x) / area.s, -.11, lift) - leave * (this.pourReduced ? .035 : .18),
        y: mix((frame.y - area.y) / area.s, -.25, lift) - leave * (this.pourReduced ? .04 : .16),
        length, thickness: mix(frame.thickness / area.s, .13, lift), rotation,
        alpha: 1 - leave, opening: P.CINEMA.easeCamera((time - .14) / .46),
        lidAngle: 1.35 * P.CINEMA.easeCamera((time - .14) / .46) };
    }
    tubePose(i, time, area) {
      const rig = this.rigAt(time, area), local = this.sources[i], pour = this.pours[i];
      const roll = clamp((time - (pour.release - POUR.roll)) / POUR.roll);
      // Accelerate down the tilted tube. The cross-section settles toward its
      // lower glass wall before the marble crosses the opened lip.
      const rolling = roll * roll * (2.6 - 1.6 * roll);
      const along = mix(local.x, 1.14, rolling) * rig.length * .45;
      const across = mix(local.y, .52, P.CINEMA.easeCamera(roll)) * rig.thickness * .42;
      const dx = Math.cos(rig.rotation), dy = Math.sin(rig.rotation);
      return { x: rig.x + dx * along - dy * across, y: rig.y + dy * along + dx * across,
        r: rig.thickness * .42 * this.cinema.chamber.radius,
        aspect: rig.length * .45 / P.CINEMA.chamberHalfLength / (rig.thickness * .42), orientation: rig.rotation };
    }
    fallingPose(i, time, area) {
      this.views(area);
      const pour = this.pours[i];
      if (!pour.path) {
        const start = this.tubePose(i, pour.release, area), before = this.tubePose(i, pour.release - .00001, area);
        pour.path = { start, vx: (start.x - before.x) / .00001, vy: (start.y - before.y) / .00001 };
      }
      const { start, vx, vy } = pour.path;
      const duration = pour.arrival - pour.release, u = clamp((time - pour.release) / duration);
      const age = u * duration;
      // Once clear of the lip, no spline attracts a ball to an assigned point.
      // Its exit tangent continues horizontally; gravity alone accelerates y.
      const round = P.CINEMA.easeCamera(u);
      return { x: start.x + vx * age,
        y: start.y + vy * age + .5 * POUR.gravity * age * age,
        vx, vy: vy + POUR.gravity * age,
        r: mix(start.r, this.shuffle.bodies[i].r * .84, round),
        aspect: mix(start.aspect, 1, round), orientation: start.orientation * (1-round) };
    }
    drawTube(area, glass = false) {
      const c = this.cinema, ctx = c.ctx, rig = this.rigAt(this.elapsed, area);
      if (rig.alpha <= .001) return;
      const views = this.views(area), frame = views.frame;
      ctx.save(); ctx.translate(area.x + rig.x * area.s, area.y + rig.y * area.s); ctx.rotate(rig.rotation);
      // Keep the glass aperture fixed. The original gold cap is a separate
      // hinged slice of the same plate, rather than a disappearing clip wipe.
      const mouth = .49 * rig.length * area.s;
      ctx.beginPath(); ctx.rect(-area.s * 3, -area.s * 3, area.s * 3 + mouth, area.s * 6); ctx.clip();
      ctx.scale(rig.length * area.s / frame.length, rig.thickness * area.s / frame.thickness);
      ctx.rotate(-frame.rotation); ctx.translate(-frame.x, -frame.y);
      if (glass) c.drawGlass(views.front, views.angle, 0, 0, rig.alpha, 0);
      else c.drawPlate('front', views.front, rig.alpha);
      ctx.restore();
      if (glass) {
        const hingeY = -rig.thickness * .43 * area.s;
        ctx.save();ctx.translate(area.x+rig.x*area.s,area.y+rig.y*area.s);ctx.rotate(rig.rotation);
        ctx.translate(mouth,hingeY);ctx.rotate(-rig.lidAngle);ctx.translate(-mouth,-hingeY);
        ctx.beginPath();ctx.rect(mouth,-area.s*3,area.s*3,area.s*6);ctx.clip();
        ctx.scale(rig.length*area.s/frame.length,rig.thickness*area.s/frame.thickness);
        ctx.rotate(-frame.rotation);ctx.translate(-frame.x,-frame.y);c.drawPlate('front',views.front,rig.alpha);ctx.restore();
        ctx.save();ctx.globalAlpha=rig.alpha;ctx.translate(area.x+rig.x*area.s,area.y+rig.y*area.s);ctx.rotate(rig.rotation);
        ctx.fillStyle='#b79a61';ctx.beginPath();ctx.arc(mouth,hingeY,Math.max(1,area.s*.0035),0,Math.PI*2);ctx.fill();ctx.restore();
      }
      if (glass && rig.opening > 0) {
        ctx.save(); ctx.globalAlpha = rig.alpha * rig.opening;
        ctx.translate(area.x + rig.x * area.s, area.y + rig.y * area.s); ctx.rotate(rig.rotation);
        ctx.strokeStyle = 'rgba(255,251,229,.75)'; ctx.lineWidth = Math.max(1, .004 * area.s);
        ctx.beginPath(); ctx.ellipse(rig.length * .49 * area.s, 0, rig.thickness * .075 * area.s, rig.thickness * .44 * area.s, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(144,116,67,.4)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      }
    }
    update(dt) {
      // Do not replay hidden-tab time as a burst of pouring or physics.
      dt = Math.max(0, Math.min(.05, Number(dt) || 0));
      this.elapsed += dt;
      const feedback = this.gate && this.gate.evaluate(performance.now());
      const target = feedback ? (feedback.eligible ? 1 : feedback.approach * .65) : 0;
      this.edgeGlow += (target - this.edgeGlow) * Math.min(1, dt * 9);
      this.accumulator = Math.min(.05, this.accumulator + dt);
      const area = this.area(), zoom = this.viewScale;
      const frame = P.EDGE_GEOMETRY.bounds(area), edge = P.THROW_THRESHOLDS.edgeBand;
      const halfWidth = Math.max(.1, frame.halfWidth - edge), halfHeight = Math.max(.1, frame.halfHeight - edge);
      this.shuffle.bounds = { left: -halfWidth / zoom, right: halfWidth / zoom,
        top: -halfHeight / zoom, bottom: halfHeight / zoom,
        cornerRadius: Math.min(P.THROW_THRESHOLDS.corner, halfWidth, halfHeight) / zoom,
        opening: P.EDGE_GEOMETRY.opening(frame).span / zoom,
        outer: { left: -frame.halfWidth / zoom, right: frame.halfWidth / zoom, top: -frame.halfHeight / zoom, bottom: frame.halfHeight / zoom } };
      while (this.accumulator >= 1 / 120) {
        const time = this.simulationTicks / 120;
        while (this.nextArrival < this.arrivals.length) {
          const i = this.arrivals[this.nextArrival], body = this.shuffle.bodies[i], pour = this.pours[i];
          if (time + 1e-9 < pour.arrival) break;
          this.nextArrival++;
          const arrival = this.fallingPose(i, pour.arrival, area);
          // Keep the falling position AND its tangent velocity at handoff.
          // Deposited bodies immediately collide with earlier arrivals.
          this.remaining--;
          Object.assign(body, { x: arrival.x / zoom, y: arrival.y / zoom,
            vx: arrival.vx / zoom, vy: arrival.vy / zoom, pouring: false });
        }
        if (this.remaining < this.entries.length) this.shuffle.step(1 / 120);
        this.simulationTicks++; this.accumulator -= 1 / 120;
      }
    }
    render(state) {
      const c = this.cinema, ctx = c.ctx, area = this.area(), ready = this.ready;
      ctx.clearRect(0, 0, area.w, area.h);
      const bg = ctx.createLinearGradient(0, 0, area.w, area.h);
      bg.addColorStop(0, '#faf6eb'); bg.addColorStop(.57, '#f2e9d6'); bg.addColorStop(1, '#e9dec7');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, area.w, area.h);
      if (this.gate) {
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
      this.drawTube(area);
      this.lastPoses = this.shuffle.bodies.map((body, i) => {
        const local = body.pouring ? (this.elapsed < this.pours[i].release
          ? this.tubePose(i, this.elapsed, area) : this.fallingPose(i, this.elapsed, area))
          : { x: body.x * this.viewScale, y: body.y * this.viewScale, r: body.r * this.viewScale, aspect: 1, orientation: 0 };
        const pose = { id: body.id, x: area.x + local.x * area.s, y: area.y + local.y * area.s,
          radius: local.r * area.s, aspect: local.aspect, orientation: local.orientation, focus: 1 };
        c.drawOrb(this.entries[i], pose, 0, state.physics.marbles[i], this.entries.length, state.reducedMotion);
        if (this.entries.length <= 16 && ready) c.drawLabel(this.entries[i], pose.x, pose.y, pose.radius, .68);
        return pose;
      });
      this.drawTube(area, true);
      if (ready && this.shuffle.pointer) {
        const pointer = this.shuffle.pointer, x = area.x + pointer.x * area.s * this.viewScale, y = area.y + pointer.y * area.s * this.viewScale;
        const radius = this.shuffle.pointerRadius * area.s * this.viewScale;
        const field = ctx.createRadialGradient(x, y, 0, x, y, radius);
        field.addColorStop(0, 'rgba(174,145,91,.09)'); field.addColorStop(1, 'rgba(174,145,91,0)');
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = field; ctx.fill(); ctx.strokeStyle = 'rgba(158,126,76,.18)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      }
      if (ready) {
        ctx.fillStyle = '#8a7760'; ctx.font = '12px "Pretendard Variable", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('우측 상단 출구로 공을 끌어 주세요', area.x, area.y + .38 * area.s);
      }
      if (c.canvas.dataset) c.canvas.dataset.handPhase = !ready ? (this.elapsed < POUR.firstRelease ? 'tilting' : this.elapsed < POUR.withdraw ? 'pouring' : 'settling-pour') : this.shuffle.pointer ? 'dragging' : 'settling';
      c.lastStage = 'mixing';
      return { reveal: 0 };
    }
  }
  P.HandScene = HandScene;
})(window.CosmicPinball = window.CosmicPinball || {});

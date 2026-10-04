(function (P) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  class Camera {
    constructor(canvas, options) {
      this.canvas = canvas; this.x = 500; this.y = 510; this.zoom = 1; this.follow = true; this.viewport = null; this.map = null; this.pointer = new Map(); this.drag = null; this.manualZoom = 1;
      if (!options || options.interactive !== false) this.attach(canvas);
    }
    area() {
      if (this.viewport) return this.viewport;
      const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
      return w > 1050 ? { x: 352, y: 0, w: Math.max(280, w - 632), h } : { x: 0, y: 0, w, h };
    }
    reset(map) {
      this.entrance = null; this.map = map; const area = this.area(); this.x = map.width / 2; this.y = Math.min(540, area.h / (2 * Math.min(area.w / (map.width + 90), 1.15))); this.zoom = this.baseZoom() * .82; this.follow = true; this.manualZoom = 1; this.pointer.clear();
    }
    enter(map, options) {
      const area = this.area();
      this.entrance = { elapsed: 0, duration: options && options.reducedMotion ? .18 : 1.05,
        x: this.x, y: this.y, zoom: this.zoom,
        screenX: area.x + area.w / 2, screenY: area.y + area.h / 2 };
      this.map = map; this.follow = true; this.manualZoom = 1; this.pointer.clear(); this.drag = null;
    }
    prepareLanding(map, physics) {
      this.map = map; this.entrance = null; this.follow = true; this.manualZoom = 1;
      this.pointer.clear(); this.drag = null; this.pinch = null;
      const area = this.area();
      const active = physics && physics.marbles ? physics.marbles.filter(m => !m.finished) : [];
      const spawn = map.spawn || { y: 50, height: 680 };
      let top = spawn.y, bottom = spawn.y + spawn.height;
      if (active.length) {
        top = Math.min(...active.map(m => m.y - (m.r || 12)));
        bottom = Math.max(...active.map(m => m.y + (m.r || 12)));
      }
      // The flight ends in this exact race viewport. Keep room around the actual
      // spawn bounds, including a tall 500-marble grid on a short desktop view.
      this.x = map.width / 2;
      this.zoom = Math.min(this.baseZoom() * 1.04, area.h / Math.max(1, bottom - top + 160));
      const minY = Math.max(220, area.h / (2 * this.zoom) - 30);
      const maxY = Math.max(minY, map.height - area.h / (2 * this.zoom) + 150);
      this.y = clamp((top + bottom) / 2, minY, maxY);
    }
    baseZoom() { const area = this.area(); return Math.min(area.w / ((this.map ? this.map.width : 1000) + 100), 1.15); }
    resumeFollow() { this.follow = true; this.manualZoom = 1; }
    worldToScreen(x, y) { const area = this.area(); return { x: area.x + area.w / 2 + (x - this.x) * this.zoom, y: area.y + area.h / 2 + (y - this.y) * this.zoom }; }
    screenToWorld(x, y) { const area = this.area(); return { x: this.x + (x - area.x - area.w / 2) / this.zoom, y: this.y + (y - area.y - area.h / 2) / this.zoom }; }
    update(dt, physics, map, options) {
      this.map = map; options = options || {}; if (!this.follow || !physics || !physics.marbles.length) return;
      const area = this.area(), active = physics.marbles.filter(m => !m.finished);
      if (this.entrance) {
        const e = this.entrance; e.elapsed += dt;
        const progress = clamp(e.elapsed / e.duration, 0, 1), ease = 1 - Math.pow(1 - progress, 3);
        const centerX = area.x + area.w / 2, centerY = area.y + area.h / 2;
        const targetZoom = this.baseZoom() * 1.04;
        this.zoom = e.zoom + (targetZoom - e.zoom) * ease;
        const spawnFront = active.reduce((furthest, marble) => Math.max(furthest, marble.y), 0);
        const targetY = Math.max(220, area.h / (2 * targetZoom) - 30, spawnFront - 35);
        // Interpolate the screen anchor too: collapsing the setup panel must not snap the board sideways.
        this.x = e.x + (map.width / 2 - e.x) * ease + (centerX - (e.screenX + (centerX - e.screenX) * ease)) / this.zoom;
        this.y = e.y + (targetY - e.y) * ease + (centerY - (e.screenY + (centerY - e.screenY) * ease)) / this.zoom;
        if (progress === 1) this.entrance = null;
        return;
      }
      const ranked = physics.getRanking ? physics.getRanking() : active.slice().sort((a, b) => b.y - a.y);
      const front = active.length ? active.slice().sort((a, b) => b.y - a.y)[0] : ranked[0]; if (!front) return;
      const base = this.baseZoom(); let targetZoom = base * (options.status === 'idle' ? .82 : 1.04) * this.manualZoom, targetX = map.width / 2;
      if (options.photoFinish) { targetZoom = Math.min(1.45, base * 1.45) * this.manualZoom; targetX = clamp(front.x, map.width * .25, map.width * .75); }
      else if (options.status === 'running' && active.length) {
        const close = active.filter(m => front.y - m.y < 200); const spread = close.length > 1 ? Math.max(...close.map(m => m.x)) - Math.min(...close.map(m => m.x)) : 0;
        if (spread > map.width * .8) targetZoom = base * .92 * this.manualZoom;
        const finishY = map.finish && map.finish.y || map.height - 120;
        if (front.y > finishY - 260) targetZoom = base * 1.12 * this.manualZoom;
      }
      const targetY = options.status === 'idle' ? Math.max(460, front.y - 35) : options.status === 'countdown' ? Math.max(220, front.y - 35) : front.y + 60;
      const lerp = 1 - Math.exp(-dt * 3.1), zLerp = 1 - Math.exp(-dt * 2.4);
      this.x += (targetX - this.x) * lerp; this.zoom += (targetZoom - this.zoom) * zLerp;
      const minY = Math.max(220, area.h / (2 * this.zoom) - 30), maxY = Math.max(minY, map.height - area.h / (2 * this.zoom) + 150);
      this.y += (clamp(targetY, minY, maxY) - this.y) * lerp;
    }
    attach(canvas) {
      if (this.attached) return; this.attached = true;
      const position = e => { const rect = canvas.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; };
      const stopFollowing = () => { this.entrance = null; if (this.follow) { this.follow = false; canvas.dispatchEvent(new CustomEvent('followchange', { detail: false })); } };
      const scaleAt = (next, x, y) => { const before = this.screenToWorld(x, y); this.zoom = clamp(next, .16, 2.8); const after = this.screenToWorld(x, y); this.x += before.x - after.x; this.y += before.y - after.y; };
      canvas.addEventListener('wheel', e => { e.preventDefault(); const p = position(e); stopFollowing(); scaleAt(this.zoom * Math.exp(-e.deltaY * .0013), p.x, p.y); }, { passive: false });
      canvas.addEventListener('pointerdown', e => {
        if (e.button !== undefined && e.button > 0) return; const p = position(e); this.pointer.set(e.pointerId, p); canvas.setPointerCapture(e.pointerId);
        if (this.pointer.size === 1) this.drag = { x: p.x, y: p.y, originalX: p.x, originalY: p.y };
        else if (this.pointer.size === 2) { const points = [...this.pointer.values()]; this.pinch = { distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), zoom: this.zoom }; stopFollowing(); }
      });
      canvas.addEventListener('pointermove', e => {
        if (!this.pointer.has(e.pointerId)) return; const p = position(e); this.pointer.set(e.pointerId, p);
        if (this.pointer.size === 2 && this.pinch) { const points = [...this.pointer.values()], d = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); scaleAt(this.pinch.zoom * d / Math.max(1, this.pinch.distance), (points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2); }
        else if (this.pointer.size === 1 && this.drag) { if (Math.hypot(p.x - this.drag.originalX, p.y - this.drag.originalY) > 4) stopFollowing(); if (!this.follow) { this.x -= (p.x - this.drag.x) / this.zoom; this.y -= (p.y - this.drag.y) / this.zoom; } this.drag.x = p.x; this.drag.y = p.y; }
      });
      const release = e => { this.pointer.delete(e.pointerId); this.pinch = null; if (!this.pointer.size) this.drag = null; else { const p = [...this.pointer.values()][0]; this.drag = { x: p.x, y: p.y, originalX: p.x, originalY: p.y }; } };
      canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
      document.addEventListener('keydown', e => { if (e.key.toLowerCase() !== 'f' || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return; this.follow = !this.follow; if (this.follow) this.manualZoom = 1; canvas.dispatchEvent(new CustomEvent('followchange', { detail: this.follow })); });
    }
  }
  P.Camera = Camera;
})(window.CosmicPinball = window.CosmicPinball || {});

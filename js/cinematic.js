(function (P) {
  'use strict';
  const TAU = Math.PI * 2;
  const FIRE_MOMENT = .12;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const interval = (a, b, x) => smooth((x - a) / (b - a));
  const COATS = [
    ['#faf7e8', '#ded1b5', '#a99678'], ['#fff0ba', '#d6a340', '#927027'],
    ['#d8eedc', '#81ac8b', '#466853'], ['#fbf9ed', '#e7dfcd', '#b0a08a'],
    ['#ffe2a0', '#c69331', '#7e5c21'], ['#d4e7d9', '#8eb89e', '#536f61'],
    ['#f4f5f0', '#cfcec8', '#939994'], ['#f1ded2', '#c4a18c', '#8f7766']
  ];
  const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function rng(seed) {
    let h = 2166136261;
    for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h += 0x6d2b79f5; let n = Math.imul(h ^ h >>> 15, 1 | h); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
  }
  function descriptors(physics, fallbackCount) {
    const source = physics && physics.marbles && physics.marbles.length ? physics.marbles : Array.from({ length: fallbackCount || 36 }, (_, i) => ({ id: 'preview-' + i, name: '', r: 12, colorIndex: i }));
    const seed = String(physics && physics.seed || 'mungbanggu-cinema') + '|independent-cinema|';
    const lanes = Array.from({ length: source.length }, (_, i) => i), laneRandom = rng(seed + 'release-lanes');
    for (let i = lanes.length - 1; i > 0; i--) { const j = Math.floor(laneRandom() * (i + 1)); [lanes[i], lanes[j]] = [lanes[j], lanes[i]]; }
    return source.map((m, i) => {
      const random = rng(seed + m.id + '|' + m.name + '|' + (m.copy || 1));
      return {
        id: m.id, name: m.name || '', index: i, colorIndex: m.colorIndex === undefined ? i : m.colorIndex,
        radius: m.r || 12, axial: random() * 1.7 - .85, radial: .12 + Math.sqrt(random()) * .78,
        phase: random() * TAU, spin: random() * TAU, delay: random() * .04,
        lane: (lanes[i] + .5) / source.length * 2 - 1,
        curve: random() - .5, height: .1 + random() * .18, coat: i % COATS.length
      };
    });
  }
  function tubePose(entry, time, swirl) {
    const a = entry.phase + time * (.55 + entry.radial * .24) + (swirl || 0);
    return {
      x: clamp(entry.axial + Math.sin(time * .39 + entry.phase + (swirl || 0)) * .09, -.9, .9),
      y: Math.sin(a) * entry.radial * .79,
      z: Math.cos(a) * entry.radial,
      spin: entry.spin + time * .22 + (swirl || 0) * .2
    };
  }
  function layout(width, height, shot, orbit, flight) {
    const mobile = width < 700, aspect = 1678 / 937;
    const w = Math.min(width * (mobile ? 1.28 : .99), height * aspect * .94), h = w / aspect;
    const q = smooth(orbit || 0), f = smooth(flight || 0);
    if (shot === 'front') return {
      w, h, anchorX: .49, anchorY: .548,
      x: width * .5 - width * .12 * q, y: height * (.53 + q * .045),
      scaleX: 1 - q * .22, scaleY: 1 + q * .035, shear: -q * .04, rotation: q * .025
    };
    const dolly = mobile ? 1.14 : 1.06;
    return {
      w, h, anchorX: .255, anchorY: .615,
      x: width * (.355 - q * .065 - f * .19), y: height * (.59 + q * .02 + f * .095),
      scaleX: dolly * (1 + f * .09), scaleY: dolly * (1 + f * .09), shear: (1 - q) * .035,
      rotation: (1 - q) * -.025
    };
  }
  function pointInPlate(view, u, v) {
    if (view.matrix) {
      const m = view.matrix, x = u * view.w, y = v * view.h;
      return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
    }
    const x = (u - view.anchorX) * view.w, y = (v - view.anchorY) * view.h;
    const sx = x * view.scaleX + y * view.shear, sy = y * view.scaleY, c = Math.cos(view.rotation), s = Math.sin(view.rotation);
    return { x: view.x + sx * c - sy * s, y: view.y + sx * s + sy * c };
  }
  function matchedViews(width, height, orbit, flight) {
    const front = layout(width, height, 'front', 0, 0), angle = layout(width, height, 'angle', 1, flight || 0), t = smooth(orbit || 0);
    const f1 = pointInPlate(front, .31, .548), f2 = pointInPlate(front, .697, .548);
    const a1 = pointInPlate(angle, .193, .66), a2 = pointInPlate(angle, .317, .537);
    const fl = Math.hypot(f2.x - f1.x, f2.y - f1.y), al = Math.hypot(a2.x - a1.x, a2.y - a1.y);
    const rotation = lerp(Math.atan2(f2.y - f1.y, f2.x - f1.x), Math.atan2(a2.y - a1.y, a2.x - a1.x), t);
    const frame = {
      x: lerp((f1.x + f2.x) / 2, (a1.x + a2.x) / 2, t),
      y: lerp((f1.y + f2.y) / 2, (a1.y + a2.y) / 2, t),
      length: lerp(fl, al, t), thickness: lerp(front.h * .264, angle.h * .156 * angle.scaleY, t),
      rotation, axisX: Math.cos(rotation), axisY: Math.sin(rotation), baseThickness: front.h * .264
    };
    function register(view, p1, p2, sourceThickness) {
      const x1 = p1[0] * view.w, y1 = p1[1] * view.h, x2 = p2[0] * view.w, y2 = p2[1] * view.h;
      const length = Math.hypot(x2 - x1, y2 - y1), sx = (x2 - x1) / length, sy = (y2 - y1) / length;
      const nx = -sy, ny = sx, tx = frame.axisX, ty = frame.axisY, tnX = -ty, tnY = tx;
      const longitudinal = frame.length / length, transverse = frame.thickness / sourceThickness;
      const m = {
        a: tx * sx * longitudinal + tnX * nx * transverse,
        b: ty * sx * longitudinal + tnY * nx * transverse,
        c: tx * sy * longitudinal + tnX * ny * transverse,
        d: ty * sy * longitudinal + tnY * ny * transverse
      };
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      m.e = frame.x - m.a * cx - m.c * cy; m.f = frame.y - m.b * cx - m.d * cy;
      view.matrix = m; view.frame = frame; return view;
    }
    return { front: register(front, [.31, .548], [.697, .548], front.h * .264), angle: register(angle, [.193, .66], [.317, .537], angle.h * .156), frame };
  }
  function project(local, front, angle, orbit) {
    if (front.frame) {
      const f = front.frame, lateral = local.y * f.thickness * .42 + local.z * f.thickness * .035;
      const axial = local.x * f.length * .45 + local.z * f.length * .018 * orbit;
      return { x: f.x + f.axisX * axial - f.axisY * lateral, y: f.y + f.axisY * axial + f.axisX * lateral,
        depth: local.z, scale: f.thickness / f.baseThickness * (.88 + local.z * .14) };
    }
    const a = pointInPlate(front, .49 + local.x * .173 + local.z * .005, .548 + local.y * .111 + local.z * .008);
    const b = pointInPlate(angle, .248 + local.x * .070 + local.y * .029 + local.z * .008, .600 - local.x * .066 + local.y * .071 + local.z * .012);
    return { x: lerp(a.x, b.x, orbit), y: lerp(a.y, b.y, orbit), depth: local.z, scale: lerp(front.scaleY, angle.scaleY * .71, orbit) * (.88 + local.z * .14) };
  }
  function blastPose(progress, reduced) {
    const after = progress - FIRE_MOMENT;
    const active = after >= 0;
    return {
      fired: active,
      compression: active ? 0 : Math.sin(clamp(progress / FIRE_MOMENT, 0, 1) * Math.PI),
      recoil: !reduced && active && after < .28 ? Math.sin(after * 64) * Math.exp(-after * 24) * (1 - interval(.21, .28, after)) : 0,
      flash: !reduced && active && after < .14 ? Math.exp(-after * 47) * interval(0, .004, after) : 0,
      shock: !reduced && active ? clamp(after / .17, 0, 1) : 0,
      shake: !reduced && active ? Math.exp(-after * 29) * (1 - interval(.15, .23, after)) : 0,
      smoke: !reduced && active ? interval(0, .025, after) * (1 - interval(.15, .42, after)) : 0,
      after: Math.max(0, after)
    };
  }
  function assemblyPose(progress, view, finalView, reduced) {
    const p = clamp(progress, 0, 1), amount = interval(.37, .79, p);
    const finalCenter = pointInPlate(finalView, .244, .769), finalFrame = finalView.frame, frame = view.frame;
    const m = finalView.matrix;
    const axisX = { x: m.a * finalView.w * .083, y: m.b * finalView.w * .083 };
    const axisY = { x: m.c * finalView.h * .137, y: m.d * finalView.h * .137 };
    const radius = Math.max(Math.hypot(axisX.x, axisX.y), Math.hypot(axisY.x, axisY.y));
    // Use the completed wheel dimensions. Registering a wheel to the long front barrel
    // would stretch it several times before the orbit has completed.
    const dx = finalCenter.x - finalFrame.x, dy = finalCenter.y - finalFrame.y;
    const along = dx * finalFrame.axisX + dy * finalFrame.axisY, across = -dx * finalFrame.axisY + dy * finalFrame.axisX;
    const center = { x: frame.x + frame.axisX * along - frame.axisY * across,
      y: frame.y + frame.axisY * along + frame.axisX * across };
    const settle = reduced ? 0 : Math.sin((p - .79) * 28) * Math.exp(-Math.max(0, p - .79) * 18) * interval(.79, .82, p) * (1 - interval(.95, 1, p));
    return {
      x: center.x, y: center.y + (reduced ? 0 : (1 - amount) * radius * 1.65 + settle * radius * .055),
      axisX, axisY, radius, alpha: interval(.38, .54, p),
      scale: .94 + amount * .06, rotation: reduced || p === 1 ? 0 : (1 - amount) * -.65 + settle * .018,
      support: amount, complete: p === 1
    };
  }
  function dischargeOrigin(entry, muzzle, radius, screen) {
    const lane = entry.lane === undefined ? Math.sin(entry.phase || 0) * (entry.radial || .7) : entry.lane;
    const across = lane * (screen.muzzleRadius || radius * 1.7) * .8;
    const ax = screen.axisX === undefined ? .85 : screen.axisX, ay = screen.axisY === undefined ? -.5267826876 : screen.axisY;
    return { x: muzzle.x - ay * across, y: muzzle.y + ax * across };
  }
  function flightPose(entry, progress, start, muzzle, target, startRadius, endRadius, screen) {
    if (progress >= 1) return { x: target.x, y: target.y, radius: endRadius, depth: 0, amount: 1, focus: 1 };
    const release = FIRE_MOMENT + (entry.delay || 0), gatherEnd = .073;
    const axisLength = Math.hypot(muzzle.x - start.x, muzzle.y - start.y) || 1;
    const ax = screen.axisX === undefined ? (muzzle.x - start.x) / axisLength : screen.axisX;
    const ay = screen.axisY === undefined ? (muzzle.y - start.y) / axisLength : screen.axisY;
    const origin = dischargeOrigin(entry, muzzle, startRadius, { ...screen, axisX: ax, axisY: ay });
    const fan = (entry.lane || 0) * .18, cos = Math.cos(fan), sin = Math.sin(fan);
    const dx = ax * cos - ay * sin, dy = ax * sin + ay * cos;
    const first = { x: origin.x + dx * screen.width * (.31 + entry.curve * .02), y: origin.y + dy * screen.width * (.31 + entry.curve * .02) };
    const second = { x: target.x + screen.width * entry.curve * .24, y: target.y - screen.height * entry.height };
    const chamber = { x: origin.x - ax * screen.width * .07, y: origin.y - ay * screen.width * .07 };
    if (progress < gatherEnd) {
      const u = smooth(progress / gatherEnd);
      return { x: lerp(start.x, chamber.x, u), y: lerp(start.y, chamber.y, u), radius: startRadius,
        depth: start.depth || 0, amount: 0, focus: .78, contained: true };
    }
    if (progress < release) {
      const u = clamp((progress - gatherEnd) / (release - gatherEnd), 0, 1), v = 1 - u;
      const velocityScale = (release - gatherEnd) * 2.4 / (1 - release);
      const beforeMuzzle = { x: origin.x - (first.x - origin.x) * velocityScale, y: origin.y - (first.y - origin.y) * velocityScale };
      return { x: v * v * v * chamber.x + 3 * v * v * u * chamber.x + 3 * v * u * u * beforeMuzzle.x + u * u * u * origin.x,
        y: v * v * v * chamber.y + 3 * v * v * u * chamber.y + 3 * v * u * u * beforeMuzzle.y + u * u * u * origin.y,
        radius: startRadius, depth: start.depth || 0, amount: 0, focus: .78, contained: true };
    }
    // Discharge begins with velocity at the muzzle, then decelerates as the camera
    // meets the board. Its first derivative matches the in-barrel acceleration.
    const t = clamp((progress - release) / (1 - release), 0, 1), u = 1 - Math.pow(1 - t, 2.4), v = 1 - u;
    return {
      x: v * v * v * origin.x + 3 * v * v * u * first.x + 3 * v * u * u * second.x + u * u * u * target.x,
      y: v * v * v * origin.y + 3 * v * v * u * first.y + 3 * v * u * u * second.y + u * u * u * target.y,
      radius: lerp(startRadius * (1 + Math.sin(u * Math.PI) * .27), endRadius, interval(.48, 1, u)),
      depth: Math.sin(u * Math.PI) * entry.curve, amount: t, focus: lerp(.78, 1, interval(.45, .96, u)), contained: false
    };
  }
  function pill(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function sparkle(ctx, x, y, r) {
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x + r * .18, y - r * .18, x + r, y); ctx.quadraticCurveTo(x + r * .18, y + r * .18, x, y + r); ctx.quadraticCurveTo(x - r * .18, y + r * .18, x - r, y); ctx.quadraticCurveTo(x - r * .18, y - r * .18, x, y - r); ctx.fill();
  }
  class Cinematic {
    constructor(canvas, renderer) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.renderer = renderer;
      this.quality = 'high'; this.sprites = new Map(); this.labels = new Map(); this.paperEdges = new Map(); this.featheredPlates = new Map(); this.plates = {}; this.cache = null;
      this.lastStage = null; this.lastTime = 0; this.frozenTube = null;
      const random = rng('mungbanggu-gold-dust');
      this.dust = Array.from({ length: 100 }, (_, i) => ({ x: random(), y: random(), phase: random() * TAU, r: .4 + random() * 1.4, index: i }));
      this.ready = Promise.all(['front', 'angle', 'barrel', 'wheel'].map(shot => this.loadPlate(shot, './assets/cannon-' + shot + '.png')));
    }
    loadPlate(shot, path) {
      return new Promise(resolve => {
        if (typeof Image === 'undefined') { resolve(false); return; }
        const image = new Image(); image.onload = () => { this.plates[shot] = image; resolve(true); };
        image.onerror = () => resolve(false); image.src = path;
      });
    }
    setQuality(quality) { this.quality = ['high', 'medium', 'low'].includes(quality) ? quality : 'high'; }
    resize() {
      this.width = this.canvas.clientWidth || innerWidth; this.height = this.canvas.clientHeight || innerHeight;
      const limit = this.quality === 'low' ? 1 : this.quality === 'medium' ? 1.5 : P.CONFIG && P.CONFIG.maxDpr || 2;
      this.dpr = Math.min(devicePixelRatio || 1, limit);
      const w = Math.round(this.width * this.dpr), h = Math.round(this.height * this.dpr);
      if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    entries(physics) {
      const count = physics && physics.marbles && physics.marbles.length || 36;
      if (!this.cache || this.cache.physics !== physics || this.cache.count !== count) {
        this.cache = { physics, count, entries: descriptors(physics, 36) }; this.frozenTube = null;
      }
      return this.cache.entries;
    }
    orbSprite(coat, blurred) {
      const key = coat + ':' + !!blurred; if (this.sprites.has(key)) return this.sprites.get(key);
      const c = makeCanvas(144, 144), ctx = c.getContext('2d'), tones = COATS[coat % COATS.length];
      let g = ctx.createRadialGradient(72, 80, 15, 72, 80, 43); g.addColorStop(0, 'rgba(81,58,25,.18)'); g.addColorStop(1, 'rgba(81,58,25,0)'); ctx.fillStyle = g; ctx.fillRect(28, 36, 88, 88);
      g = ctx.createRadialGradient(61, 57, 0, 79, 82, 37); g.addColorStop(0, '#fffef5'); g.addColorStop(.17, tones[0]); g.addColorStop(.51, tones[1]); g.addColorStop(.83, tones[2]); g.addColorStop(1, tones[0]);
      ctx.beginPath(); ctx.arc(72, 72, 27, 0, TAU); ctx.fillStyle = g; ctx.fill();
      const rim = ctx.createLinearGradient(48, 46, 96, 101); rim.addColorStop(0, '#fff9df'); rim.addColorStop(.35, tones[1]); rim.addColorStop(.63, tones[2]); rim.addColorStop(1, '#ffedbd'); ctx.strokeStyle = rim; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.arc(72, 72, 25, 0, TAU); ctx.clip();
      ctx.strokeStyle = 'rgba(255,250,222,.27)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(74, 75, 30, 11, -.4, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,250,.66)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(72, 72, 23, 3.5, 5.3); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,247,.82)'; ctx.beginPath(); ctx.ellipse(63, 60, 8, 4.7, -.7, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,248,216,.29)'; ctx.beginPath(); ctx.ellipse(81, 84, 8.5, 3.5, -.5, 0, TAU); ctx.fill(); ctx.restore();
      if (blurred && 'filter' in ctx) { const soft = makeCanvas(144, 144), s = soft.getContext('2d'); s.filter = 'blur(1.25px)'; s.drawImage(c, 0, 0); this.sprites.set(key, soft); return soft; }
      this.sprites.set(key, c); return c;
    }
    drawPlate(shot, view, alpha) {
      if (alpha <= .001) return;
      const asset = shot === 'angle' && this.plates.barrel ? 'barrel' : shot;
      const ctx = this.ctx, image = this.plates[asset]; ctx.save(); ctx.globalAlpha = alpha;
      if (view.matrix) { const m = view.matrix; ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f); }
      else { ctx.translate(view.x, view.y); ctx.rotate(view.rotation); ctx.transform(view.scaleX, 0, view.shear, view.scaleY, 0, 0); }
      if (image) {
        const left = view.matrix ? 0 : -view.anchorX * view.w, top = view.matrix ? 0 : -view.anchorY * view.h;
        const edges = this.edgesFor(asset, image), feather = this.featherFor(asset, image), extend = Math.max(this.width, this.height) * 3;
        const insetX = view.w * feather.size / feather.width, insetY = view.h * feather.size / feather.height;
        // Extend the photographed paper itself: a contained cannon must not leave a rectangular seam.
        // Paper extends underneath the feather too, preventing the studio image's
        // outermost row from forming a thin rectangular line on portrait screens.
        ctx.drawImage(edges.top, left, top - extend, view.w, extend + insetY);
        ctx.drawImage(edges.bottom, left, top + view.h - insetY, view.w, extend + insetY);
        ctx.drawImage(edges.left, left - extend, top, extend + insetX, view.h);
        ctx.drawImage(edges.right, left + view.w - insetX, top, extend + insetX, view.h);
        ctx.drawImage(edges.corners[0], left - extend, top - extend, extend + insetX, extend + insetY);
        ctx.drawImage(edges.corners[1], left + view.w - insetX, top - extend, extend + insetX, extend + insetY);
        ctx.drawImage(edges.corners[2], left - extend, top + view.h - insetY, extend + insetX, extend + insetY);
        ctx.drawImage(edges.corners[3], left + view.w - insetX, top + view.h - insetY, extend + insetX, extend + insetY);
        ctx.drawImage(feather.image, left, top, view.w, view.h);
      }
      else {
        const x = (.31 - view.anchorX) * view.w, y = (.4 - view.anchorY) * view.h, w = view.w * .4, h = view.h * .29;
        const glass = ctx.createLinearGradient(0, y, 0, y + h); glass.addColorStop(0, 'rgba(255,253,236,.85)'); glass.addColorStop(.5, 'rgba(209,189,147,.16)'); glass.addColorStop(1, 'rgba(197,168,112,.5)');
        ctx.fillStyle = glass; pill(ctx, x, y, w, h, 35); ctx.fill(); ctx.strokeStyle = '#d2b06b'; ctx.lineWidth = 10; ctx.stroke();
      }
      ctx.restore();
    }
    edgesFor(shot, image) {
      if (this.paperEdges.has(shot)) return this.paperEdges.get(shot);
      const w = image.naturalWidth || image.width, h = image.naturalHeight || image.height;
      const sample = (x, y, sw, sh, tw, th) => {
        const c = makeCanvas(tw, th), ctx = c.getContext('2d'); ctx.filter = 'blur(3px)';
        ctx.drawImage(image, x, y, sw, sh, -6, -6, tw + 12, th + 12); return c;
      };
      const edges = {
        top: sample(0, 0, w, 24, 128, 8), bottom: sample(0, h - 24, w, 24, 128, 8),
        left: sample(0, 0, 24, h, 8, 128), right: sample(w - 24, 0, 24, h, 8, 128),
        corners: [sample(0, 0, 48, 48, 8, 8), sample(w - 48, 0, 48, 48, 8, 8), sample(0, h - 48, 48, 48, 8, 8), sample(w - 48, h - 48, 48, 48, 8, 8)]
      };
      this.paperEdges.set(shot, edges); return edges;
    }
    featherFor(shot, image) {
      if (this.featheredPlates.has(shot)) return this.featheredPlates.get(shot);
      const w = image.naturalWidth || image.width, h = image.naturalHeight || image.height;
      const size = Math.min(45, w * .04, h * .06), c = makeCanvas(w, h), ctx = c.getContext('2d');
      ctx.drawImage(image, 0, 0, w, h); ctx.globalCompositeOperation = 'destination-in';
      const horizontal = ctx.createLinearGradient(0, 0, w, 0);
      horizontal.addColorStop(0, 'rgba(255,255,255,0)'); horizontal.addColorStop(size / w, '#fff');
      horizontal.addColorStop(1 - size / w, '#fff'); horizontal.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = horizontal; ctx.fillRect(0, 0, w, h);
      const vertical = ctx.createLinearGradient(0, 0, 0, h);
      vertical.addColorStop(0, 'rgba(255,255,255,0)'); vertical.addColorStop(size / h, '#fff');
      vertical.addColorStop(1 - size / h, '#fff'); vertical.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = vertical; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over';
      const plate = { image: c, size, width: w, height: h }; this.featheredPlates.set(shot, plate); return plate;
    }
    glassPath(front, angle, orbit) {
      if (front.frame) {
        const f = front.frame, radius = f.thickness / 2, ctx = this.ctx;
        ctx.save(); ctx.translate(f.x - f.axisX * f.length / 2, f.y - f.axisY * f.length / 2); ctx.rotate(f.rotation);
        pill(ctx, -radius * .35, -radius, f.length + radius * .7, radius * 2, radius * .56); ctx.restore(); return;
      }
      const ctx = this.ctx, a = pointInPlate(front, .31, .548), b = pointInPlate(front, .697, .548);
      const c = pointInPlate(angle, .193, .66), d = pointInPlate(angle, .317, .537);
      const x1 = lerp(a.x, c.x, orbit), y1 = lerp(a.y, c.y, orbit), x2 = lerp(b.x, d.x, orbit), y2 = lerp(b.y, d.y, orbit);
      const radius = lerp(front.h * .132 * front.scaleY, angle.h * .078 * angle.scaleY, orbit), distance = Math.hypot(x2 - x1, y2 - y1), rotation = Math.atan2(y2 - y1, x2 - x1);
      ctx.save(); ctx.translate(x1, y1); ctx.rotate(rotation); pill(ctx, -radius * .35, -radius, distance + radius * .7, radius * 2, radius * .56); ctx.restore();
    }
    drawGlass(front, angle, orbit, time, alpha) {
      const ctx = this.ctx; ctx.save(); this.glassPath(front, angle, orbit); ctx.clip();
      const center = project({ x: 0, y: 0, z: 0 }, front, angle, orbit), span = front.w * .45;
      const glint = ctx.createLinearGradient(center.x - span, center.y - 80, center.x + span, center.y + 80);
      glint.addColorStop(0, 'rgba(255,255,240,0)'); glint.addColorStop(.38, 'rgba(255,255,245,.02)'); glint.addColorStop(.5, 'rgba(255,255,243,.18)'); glint.addColorStop(.65, 'rgba(255,255,243,.01)'); glint.addColorStop(1, 'rgba(255,255,240,0)');
      ctx.globalAlpha = alpha; ctx.fillStyle = glint; ctx.fillRect(center.x - span, center.y - span / 2, span * 2, span);
      if (this.quality !== 'low') { ctx.globalAlpha = alpha * .16; ctx.strokeStyle = '#fff9de'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(center.x - span / 2, center.y - front.h * .078 + Math.sin(time * .45) * 3); ctx.lineTo(center.x + span / 2, center.y - front.h * .076); ctx.stroke(); }
      ctx.restore();
    }
    drawCarriage(pose, frame, alpha) {
      if (pose.alpha * alpha <= .001) return; const ctx = this.ctx, radius = pose.radius;
      ctx.save(); ctx.globalAlpha = pose.alpha * alpha * pose.support;
      ctx.save(); ctx.translate(pose.x, pose.y + radius * .9); ctx.scale(1, .19);
      const shadow = ctx.createRadialGradient(0, 0, radius * .05, 0, 0, radius * 1.8);
      shadow.addColorStop(0, 'rgba(97,69,27,.2)'); shadow.addColorStop(1, 'rgba(97,69,27,0)');
      ctx.fillStyle = shadow; ctx.beginPath(); ctx.arc(0, 0, radius * 1.8, 0, TAU); ctx.fill(); ctx.restore();
      const socket = { x: frame.x - frame.axisX * frame.length * .10 - frame.axisY * frame.thickness * .40,
        y: frame.y - frame.axisY * frame.length * .10 + frame.axisX * frame.thickness * .40 };
      const gold = ctx.createLinearGradient(pose.x - radius * .2, pose.y, socket.x, socket.y);
      gold.addColorStop(0, '#8c6a31'); gold.addColorStop(.33, '#e6d093'); gold.addColorStop(.55, '#b99a5e'); gold.addColorStop(1, '#8b6529');
      ctx.lineCap = 'round'; ctx.strokeStyle = '#84612e'; ctx.lineWidth = radius * .15;
      ctx.beginPath(); ctx.moveTo(pose.x, pose.y); ctx.lineTo(socket.x, socket.y); ctx.stroke();
      ctx.strokeStyle = gold; ctx.lineWidth = radius * .115; ctx.stroke(); ctx.restore();
    }
    drawWheel(pose, alpha, rock) {
      const image = this.plates.wheel || this.plates.angle; if (!image || pose.alpha * alpha <= .001) return;
      const ctx = this.ctx; ctx.save(); ctx.globalAlpha = pose.alpha * alpha;
      ctx.translate(pose.x, pose.y); ctx.rotate(pose.rotation + (rock || 0));
      ctx.transform(pose.axisX.x * pose.scale, pose.axisX.y * pose.scale, pose.axisY.x * pose.scale, pose.axisY.y * pose.scale, 0, 0);
      if (this.plates.wheel) ctx.drawImage(image, -1 / .85, -1 / .85, 2 / .85, 2 / .85);
      else {
        ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.clip();
        const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
        ctx.drawImage(image, iw * .161, ih * .632, iw * .166, ih * .274, -1, -1, 2, 2);
      }
      ctx.restore();
    }
    drawDischarge(origin, frame, blast, width, height) {
      if (!blast.fired || blast.after > .5) return;
      const ctx = this.ctx, axisX = frame.axisX, axisY = frame.axisY, radius = clamp(frame.thickness * .56, 12, 58);
      ctx.save(); ctx.translate(origin.x, origin.y); ctx.rotate(frame.rotation);
      if (blast.flash > .01) {
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = blast.flash;
        const flare = ctx.createRadialGradient(radius * .2, 0, radius * .025, radius * .5, 0, radius * 2.7);
        flare.addColorStop(0, '#fffef2'); flare.addColorStop(.13, '#fff4b7'); flare.addColorStop(.36, 'rgba(248,199,96,.78)'); flare.addColorStop(1, 'rgba(235,160,53,0)');
        ctx.save(); ctx.scale(1.8, .72); ctx.fillStyle = flare; ctx.fillRect(-radius * 2.4, -radius * 3, radius * 6.2, radius * 6); ctx.restore();
        // Rounded, uneven lobes read as a short pressure plume rather than a
        // solid triangular beam. The hot core falls off into translucent amber.
        const plume = ctx.createRadialGradient(radius * .12, 0, radius * .03, radius * .42, 0, radius * 2.25);
        plume.addColorStop(0, 'rgba(255,255,240,.96)'); plume.addColorStop(.18, 'rgba(255,244,190,.93)');
        plume.addColorStop(.45, 'rgba(251,199,97,.58)'); plume.addColorStop(.78, 'rgba(230,151,51,.2)'); plume.addColorStop(1, 'rgba(221,143,46,0)');
        const flutter = Math.sin(blast.after * 157) * .065;
        ctx.fillStyle = plume; ctx.beginPath(); ctx.moveTo(-radius * .15, -radius * .32);
        ctx.bezierCurveTo(radius * .3, -radius * .44, radius * .45, -radius * (.75 + flutter), radius * .92, -radius * .43);
        ctx.bezierCurveTo(radius * 1.26, -radius * .76, radius * 1.72, -radius * .48, radius * 1.6, -radius * .24);
        ctx.bezierCurveTo(radius * 2.1, -radius * .3, radius * 2.42, -radius * .11, radius * 2.03, radius * .08);
        ctx.bezierCurveTo(radius * 2.35, radius * .4, radius * 1.66, radius * .58, radius * 1.47, radius * .32);
        ctx.bezierCurveTo(radius * 1.21, radius * (.66 - flutter), radius * .68, radius * .65, radius * .65, radius * .34);
        ctx.bezierCurveTo(radius * .36, radius * .59, -radius * .01, radius * .44, -radius * .15, radius * .32);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      if (blast.shock > 0 && blast.shock < 1) {
        const distance = radius * (1 + blast.shock * 4.3);
        ctx.save(); ctx.globalAlpha = (1 - blast.shock) * .62; ctx.strokeStyle = '#fff8dc'; ctx.lineWidth = 1.5 + (1 - blast.shock) * 5;
        ctx.beginPath(); ctx.ellipse(blast.shock * radius * 3, 0, distance * .38, distance, 0, 0, TAU); ctx.stroke(); ctx.restore();
      }
      ctx.restore();
      if (blast.smoke > .001) {
        const amount = this.quality === 'low' ? 5 : this.quality === 'medium' ? 9 : 15;
        for (let i = 0; i < amount; i++) {
          const d = this.dust[i], age = blast.after, spread = radius * (1 + age * 11);
          const travel = width * age * (.23 + d.x * .2), side = (d.y - .5) * spread * 1.9;
          const x = origin.x + axisX * travel - axisY * side, y = origin.y + axisY * travel + axisX * side - height * age * age * .1;
          const size = radius * (.43 + d.y * .31) * (1 + age * 6);
          const smoke = ctx.createRadialGradient(x, y, 0, x, y, size);
          smoke.addColorStop(0, 'rgba(247,237,216,.36)'); smoke.addColorStop(.34, 'rgba(223,210,186,.31)');
          smoke.addColorStop(.63, 'rgba(157,141,111,.2)'); smoke.addColorStop(.82, 'rgba(188,169,137,.1)'); smoke.addColorStop(1, 'rgba(222,205,176,0)');
          ctx.save(); ctx.globalAlpha = blast.smoke * .9; ctx.fillStyle = smoke; ctx.fillRect(x - size, y - size, size * 2, size * 2); ctx.restore();
        }
      }
      const sparks = this.quality === 'low' ? 17 : this.quality === 'medium' ? 34 : 62;
      for (let i = 0; i < sparks; i++) {
        const d = this.dust[i], age = blast.after, life = .14 + d.y * .25; if (age >= life) continue;
        const direction = frame.rotation + (d.y - .5) * 1.05, speed = width * (.32 + d.x * .48);
        const x = origin.x + Math.cos(direction) * speed * age, y = origin.y + Math.sin(direction) * speed * age + height * age * age * .3;
        ctx.save(); ctx.globalAlpha = (1 - age / life) * .85; ctx.strokeStyle = i % 3 ? '#d2a65a' : '#fff8d4'; ctx.lineWidth = Math.max(.7, d.r * .75); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - Math.cos(direction) * speed * .009, y - Math.sin(direction) * speed * .009); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
      }
    }
    drawLabel(entry, x, y, radius, alpha) {
      if (!entry.name || alpha <= .01) return; const ctx = this.ctx, text = entry.name.length > 12 ? entry.name.slice(0, 11) + '…' : entry.name;
      let label = this.labels.get(text);
      if (!label) {
        ctx.font = '500 10px system-ui,sans-serif'; const w = Math.ceil(ctx.measureText(text).width) + 16, h = 20;
        const sprite = makeCanvas((w + 2) * 2, (h + 2) * 2), c = sprite.getContext('2d'); c.scale(2, 2); c.translate(1, 1);
        c.fillStyle = 'rgba(251,247,239,.9)'; pill(c, 0, 0, w, h, 10); c.fill(); c.strokeStyle = 'rgba(151,118,66,.3)'; c.lineWidth = .75; c.stroke();
        c.fillStyle = '#4a3a28'; c.font = '500 10px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + .5);
        label = { sprite, w: w + 2, h: h + 2 }; this.labels.set(text, label);
      }
      ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(label.sprite, x - label.w / 2, y - radius - label.h - 7, label.w, label.h); ctx.restore();
    }
    drawOrb(entry, pose, gameBlend, marble, total, reduced) {
      const ctx = this.ctx, radius = pose.radius, alpha = pose.alpha === undefined ? 1 : pose.alpha; if (radius <= 0 || alpha <= .001) return;
      const soft = !reduced && this.quality === 'high' && pose.focus < .75;
      if (gameBlend < .999) { ctx.save(); ctx.globalAlpha = (1 - gameBlend) * alpha; const size = radius * 144 / 27; ctx.drawImage(this.orbSprite(entry.coat, soft), pose.x - size / 2, pose.y - size / 2, size, size); ctx.restore(); }
      if (gameBlend > .001 && marble && this.renderer) {
        ctx.save(); ctx.globalAlpha = gameBlend * alpha;
        const color = P.marbleColor(marble.colorIndex, total, this.renderer.theme); ctx.drawImage(this.renderer.marbleSprite(color), pose.x - radius * 2.56, pose.y - radius * 2.56, radius * 5.12, radius * 5.12);
        ctx.translate(pose.x, pose.y); ctx.rotate((marble.angle || 0) * .35); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(-radius * .29, -radius * .38, radius * .3, radius * .16, -.6, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.17)'; ctx.beginPath(); ctx.ellipse(radius * .29, radius * .35, radius * .17, radius * .06, -.5, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
    drawDust(front, angle, orbit, time, alpha, reduced) {
      if (alpha < .01) return; const ctx = this.ctx, count = reduced ? 8 : this.quality === 'low' ? 18 : this.quality === 'medium' ? 42 : 76;
      ctx.save();
      for (let i = 0; i < count; i++) {
        const d = this.dust[i], local = { x: (d.x - .5) * 1.9, y: (d.y - .5) * 2.05, z: 0 }, p = project(local, front, angle, orbit);
        const twinkle = reduced ? .2 : .28 + Math.sin(time * .85 + d.phase) * .17;
        ctx.globalAlpha = alpha * twinkle; ctx.fillStyle = i % 3 ? '#fff9db' : '#d7b875';
        if (i % 7 === 0) sparkle(ctx, p.x, p.y, d.r * 2); else { ctx.beginPath(); ctx.arc(p.x, p.y, d.r, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
    }
    render(state) {
      state = state || {}; this.resize(); const ctx = this.ctx, w = this.width, h = this.height;
      const stage = state.stage || 'intro', p = clamp(Number(state.progress) || 0, 0, 1), time = Number(state.time) || 0, reduced = !!state.reducedMotion;
      const entries = this.entries(state.physics), count = entries.length, marbles = state.physics && state.physics.marbles || [];
      ctx.clearRect(0, 0, w, h);
      if (stage === 'flight' && p === 1 && state.camera) {
        for (const entry of entries) { const m = marbles[entry.index]; if (!m) continue; const target = state.camera.worldToScreen(m.x, m.y); this.drawOrb(entry, { x: target.x, y: target.y, radius: m.r * state.camera.zoom, focus: 1 }, 1, m, count, reduced); }
        this.lastStage = stage; this.lastTime = time; return { reveal: 1 };
      }
      const aiming = stage === 'aiming' ? reduced ? p < .5 ? 0 : 1 : p : stage === 'flight' ? 1 : 0, orbit = smooth(aiming);
      const flight = stage === 'flight' ? p : 0;
      const views = matchedViews(w, h, aiming, reduced ? 0 : interval(.2, .98, flight) * .65), front = views.front, angle = views.angle, resting = matchedViews(w, h, 1, 0);
      const dissolve = interval(.56, .69, aiming), reveal = stage === 'flight' ? interval(.47, .99, p) : 0;
      const frontWeight = reduced && stage === 'aiming' ? 1 - interval(0, .46, p) : 1 - dissolve;
      const angleWeight = reduced && stage === 'aiming' ? interval(.54, 1, p) : dissolve;
      const reducedFade = reduced && stage === 'aiming' ? frontWeight + angleWeight : 1;
      const backgroundAlpha = stage === 'flight' ? 1 - interval(.5, .98, p) : 1, plateAlpha = stage === 'flight' ? 1 - interval(.35, .93, p) : 1;
      const blast = blastPose(flight, reduced), wheel = assemblyPose(aiming, angle, resting.angle, reduced);
      ctx.save();
      if (stage === 'flight' && blast.shake > .001) {
        const strength = Math.min(8, w * .005) * blast.shake;
        ctx.translate(Math.sin(blast.after * 183) * strength, Math.cos(blast.after * 141) * strength * .68);
      }
      ctx.save(); ctx.globalAlpha = backgroundAlpha;
      const bg = ctx.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#faf6eb'); bg.addColorStop(.57, '#f2e9d6'); bg.addColorStop(1, '#e9dec7'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); ctx.restore();
      this.drawCarriage(wheel, views.frame, plateAlpha);
      ctx.save();
      if (stage === 'flight' && !reduced) {
        const recoil = blast.recoil * Math.min(22, w * .017) + blast.compression * 2.5;
        ctx.translate(-views.frame.axisX * recoil, -views.frame.axisY * recoil);
      }
      this.drawPlate('front', front, frontWeight * plateAlpha); this.drawPlate('angle', angle, angleWeight * plateAlpha);
      ctx.restore();
      const swirl = stage === 'mixing' && !reduced ? smooth(p) * TAU * 3 : 0;
      const baseRadius = clamp(Math.sqrt(front.w * front.h * .078 / Math.max(1, count)) * .44, w < 700 ? 2.4 : 3.5, front.w * .029);
      if (stage === 'flight' && (this.lastStage !== 'flight' || !this.frozenTube)) this.frozenTube = entries.map(entry => tubePose(entry, reduced ? 0 : this.lastTime || time, 0));
      const drawn = entries.map(entry => {
        const local = stage === 'flight' ? this.frozenTube[entry.index] : tubePose(entry, reduced ? 0 : time, swirl);
        const screen = project(local, front, angle, orbit), radius = baseRadius * screen.scale;
        if (stage !== 'flight') return { entry, local, pose: { x: screen.x, y: screen.y, radius, depth: local.z, focus: local.z < -.35 ? .45 : 1, alpha: reducedFade }, blend: 0 };
        const restingAngle = resting.angle, restingFront = resting.front, start = project(local, restingFront, restingAngle, 1);
        const muzzle = pointInPlate(restingAngle, .359, .511), m = marbles[entry.index];
        const target = m && state.camera ? state.camera.worldToScreen(m.x, m.y) : { x: w * .72, y: h * .23 };
        const endRadius = m && state.camera ? m.r * state.camera.zoom : radius * .4;
        const pose = flightPose(entry, p, start, muzzle, target, baseRadius * start.scale, endRadius, { width: w, height: h, axisX: resting.frame.axisX, axisY: resting.frame.axisY, muzzleRadius: resting.frame.thickness * .43 });
        if (reduced) {
          const beginning = p < .5; pose.x = beginning ? start.x : target.x; pose.y = beginning ? start.y : target.y;
          pose.radius = beginning ? baseRadius * start.scale : endRadius;
          pose.alpha = beginning ? 1 - interval(.04, .44, p) : interval(.55, .9, p);
        }
        return { entry, local, pose, blend: interval(.58, .98, p) };
      });
      drawn.sort((a, b) => a.pose.depth - b.pose.depth);
      if (stage !== 'flight') { ctx.save(); this.glassPath(front, angle, orbit); ctx.clip(); }
      for (const item of drawn) {
        const { entry, pose } = item, m = marbles[entry.index];
        if (stage === 'flight' && !reduced && this.quality !== 'low' && p > FIRE_MOMENT + entry.delay && p < .94) {
          const local = this.frozenTube[entry.index], start = project(local, resting.front, resting.angle, 1), muzzle = pointInPlate(resting.angle, .359, .511);
          const target = m && state.camera ? state.camera.worldToScreen(m.x, m.y) : { x: w * .72, y: h * .23 };
          const prior = flightPose(entry, Math.max(FIRE_MOMENT + entry.delay, p - .016), start, muzzle, target, baseRadius * start.scale, m && state.camera ? m.r * state.camera.zoom : pose.radius * .4, { width: w, height: h, axisX: resting.frame.axisX, axisY: resting.frame.axisY, muzzleRadius: resting.frame.thickness * .43 });
          ctx.save(); ctx.globalAlpha = (1 - interval(.7, .94, p)) * (count > 160 ? .21 : .47); ctx.strokeStyle = COATS[entry.coat][1]; ctx.lineWidth = Math.max(.7, pose.radius * .39); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(prior.x, prior.y); ctx.lineTo(pose.x, pose.y); ctx.stroke();
          if (count <= 80) { ctx.globalAlpha *= .45; ctx.lineWidth = Math.max(1, pose.radius * 1.1); ctx.stroke(); } ctx.restore();
        }
        this.drawOrb(entry, pose, item.blend, m, count, reduced);
        if (count <= 16 && stage !== 'intro' && (stage !== 'mixing' || reduced)) this.drawLabel(entry, pose.x, pose.y, pose.radius, (stage === 'flight' ? interval(.5, .95, p) : .68) * (pose.alpha === undefined ? 1 : pose.alpha));
      }
      if (stage !== 'flight') ctx.restore();
      if (stage !== 'flight' || p < FIRE_MOMENT + .025) this.drawGlass(front, angle, orbit, reduced ? 0 : time, plateAlpha * reducedFade);
      this.drawWheel(wheel, plateAlpha, stage === 'flight' ? blast.recoil * .018 : 0);
      this.drawDust(front, angle, orbit, reduced ? 0 : time, plateAlpha * reducedFade, reduced);
      if (stage === 'flight' && !reduced) {
        this.drawDischarge(pointInPlate(resting.angle, .359, .511), resting.frame, blast, w, h);
      }
      if (stage === 'flight' && !reduced && p > FIRE_MOMENT && p < .91) {
        const origin = pointInPlate(resting.angle, .359, .511), amount = this.quality === 'low' ? 20 : this.quality === 'medium' ? 45 : 82;
        ctx.save();
        for (let i = 0; i < amount; i++) {
          const d = this.dust[i], t = clamp((p - FIRE_MOMENT - (i % 7) * .003) / .73, 0, 1); if (t <= 0 || t >= 1) continue;
          const x = origin.x + w * (.15 + d.x * .45) * t, y = origin.y - Math.sin(t * Math.PI) * h * (.18 + d.y * .36);
          ctx.globalAlpha = Math.sin(t * Math.PI) * .67; ctx.fillStyle = i % 3 ? '#e6c982' : '#fff9da';
          if (i % 5 === 0) sparkle(ctx, x, y, d.r * 2); else { ctx.beginPath(); ctx.arc(x, y, d.r, 0, TAU); ctx.fill(); }
        }
        ctx.restore();
      }
      ctx.restore();
      this.lastStage = stage; this.lastTime = time;
      return { reveal, fired: stage === 'flight' && blast.fired };
    }
  }
  P.CINEMA = { smooth, interval, descriptors, tubePose, layout, matchedViews, pointInPlate, project, flightPose, dischargeOrigin, assemblyPose, blastPose, fireMoment: FIRE_MOMENT };
  P.Cinematic = Cinematic;
})(window.CosmicPinball = window.CosmicPinball || {});

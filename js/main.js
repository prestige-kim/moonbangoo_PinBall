(function () {
  'use strict';
  const P = window.CosmicPinball;
  const STORAGE_KEY = 'mungbanggu-pinball-settings-v2';
  const STEP = 1 / 120;
  const QUALITY_ORDER = ['high', 'medium', 'low'];
  const defaults = {
    names: '수박*2,키위*2,귤*2', rule: 'first', rankN: 1, map: 'classic', theme: 'cosmic',
    radius: 12, gravity: 620, restitution: 0.72, speed: 1, sound: true, volume: 0.35,
    quality: 'high', seed: 'MUNGBANGGU-2026', skills: false,
    reducedMotion: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  };
  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  }
  function normalize(input) {
    const s = Object.assign({}, defaults, input || {});
    s.names = typeof s.names === 'string' ? s.names : defaults.names;
    s.seed = typeof s.seed === 'string' ? s.seed.trim().slice(0, 128) : defaults.seed;
    s.map = P.MAPS[s.map] ? s.map : defaults.map;
    s.theme = P.THEMES[s.theme] ? s.theme : defaults.theme;
    s.rule = ['first', 'last', 'nth', 'top'].includes(s.rule) ? s.rule : 'first';
    s.rankN = Number(s.rankN);
    s.radius = clamp(s.radius, 8, 16, defaults.radius);
    s.gravity = clamp(s.gravity, 350, 1500, defaults.gravity);
    s.restitution = clamp(s.restitution, 0.35, 0.92, defaults.restitution);
    s.speed = clamp(s.speed, 0.5, 3, defaults.speed);
    s.volume = clamp(s.volume, 0, 1, defaults.volume);
    s.quality = QUALITY_ORDER.includes(s.quality) ? s.quality : 'high';
    s.sound = !!s.sound; s.skills = !!s.skills; s.reducedMotion = !!s.reducedMotion;
    return s;
  }
  function readSaved() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return normalize(JSON.parse(saved));
      const legacy = JSON.parse(localStorage.getItem('orbit-pinball-settings-v1') || 'null');
      if (!legacy) return normalize(defaults);
      // Keep participant choices; adopt the gentler pacing when upgrading the original game.
      legacy.gravity = defaults.gravity; legacy.speed = defaults.speed;
      if (legacy.seed === 'ORBIT-2026') legacy.seed = defaults.seed;
      return normalize(legacy);
    }
    catch (_) { return normalize(defaults); }
  }
  let memorySettings = readSaved();
  function save(settings) {
    memorySettings = Object.assign({}, settings);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySettings)); } catch (_) {}
  }
  P.chooseWinners = function (ranking, settings) {
    if (!ranking.length) return [];
    if (settings.rule === 'last') return [ranking[ranking.length - 1]];
    if (settings.rule === 'nth') return ranking.slice(settings.rankN - 1, settings.rankN);
    if (settings.rule === 'top') return ranking.slice(0, settings.rankN);
    return [ranking[0]];
  };
  P.ruleLabel = function (settings) {
    return { first: '1등 당첨', last: '꼴등 당첨', nth: settings.rankN + '번째 당첨', top: '상위 ' + settings.rankN + '명 당첨' }[settings.rule];
  };
  const canvas = document.getElementById('game-canvas');
  const mini = document.getElementById('minimap');
  const ui = new P.UI();
  const renderer = new P.Renderer(canvas);
  const camera = new P.Camera(canvas);
  const effects = new P.Effects();
  const audio = new P.AudioEngine();
  let settings = normalize(memorySettings);
  let runSettings = null;
  let physics = null;
  let status = 'idle';
  let countdown = 3;
  let countdownValue = null;
  let accumulator = 0;
  let lastFrame = 0;
  let elapsedVisual = 0;
  let fps = 60;
  let fpsElapsed = 0;
  let fpsFrames = 0;
  let lowFpsTime = 0;
  let qualityCooldown = 8;
  let hudElapsed = 0;
  let leaderId = null;
  let leadCooldown = 0;
  let photoFinish = false;
  let winner = null;
  let finalRanking = [];
  let resultDelay = 0;
  let resultShown = false;
  const diagnostics = { leadChanges: 0, photoFinishes: 0, events: {}, autoQualityDrops: 0, frames: 0 };
  ui.load(settings);
  function visualSettings() {
    ui.setTheme(settings.theme);
    renderer.setTheme(settings.theme);
    renderer.setQuality(settings.quality);
    if (effects.setQuality) effects.setQuality(settings.quality);
    renderer.setReducedMotion(settings.reducedMotion);
    effects.reducedMotion = settings.reducedMotion;
    audio.configure(settings);
    document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
  }
  function resize() {
    renderer.resize();
    camera.viewport = ui.getViewport();
  }
  function makePhysics(config, names) {
    return new P.Physics({
      names: names, map: P.MAPS[config.map], seed: config.seed,
      radius: config.radius, gravity: config.gravity, restitution: config.restitution, skills: config.skills
    });
  }
  function resetEffects() {
    if (effects.clear) { effects.clear(); return; }
    effects.particles.length = 0;
    effects.rings.length = 0;
    effects.shake = 0; effects.flash = 0;
  }
  function preview() {
    status = 'idle';
    ui.setFocusMode(false); resize();
    winner = null; photoFinish = false; runSettings = null;
    accumulator = 0; finalRanking = []; resultShown = false;
    resetEffects();
    let names;
    try { names = P.parseNames(settings.names); } catch (_) { names = P.parseNames(defaults.names); }
    physics = makePhysics(settings, names);
    // A frozen, physically simulated preview gives the course a living first scene.
    for (let tick = 0; tick < 260; tick++) {
      physics.step(STEP);
    }
    physics.drainEvents();
    camera.reset(P.MAPS[settings.map]);
    const ranking = physics.getRanking();
    if (ranking[0]) camera.y = Math.max(460, ranking[0].y - 40);
    ui.hideResults(); ui.hideCountdown(); ui.setStatus('idle'); ui.setLocked(false);
    ui.updateHUD({ ranking: ranking, remaining: names.length, total: names.length, time: 0, fps: fps, leader: ranking[0], seed: settings.seed, map: P.MAPS[settings.map], quality: settings.quality });
    resize();
  }
  function start(usePrevious) {
    if (status === 'running' || status === 'countdown') return;
    const next = usePrevious && runSettings ? Object.assign({}, runSettings, {
      theme: settings.theme, sound: settings.sound, volume: settings.volume,
      quality: settings.quality, reducedMotion: settings.reducedMotion, speed: settings.speed
    }) : normalize(ui.readSettings());
    let names;
    try {
      names = P.parseNames(next.names);
      if (['nth', 'top'].includes(next.rule) && (!Number.isInteger(next.rankN) || next.rankN < 1 || next.rankN > names.length)) {
        throw new Error('당첨 순위는 1부터 구슬 수(' + names.length + ')까지의 정수로 입력해 주세요.');
      }
    } catch (error) { ui.showError(error.message); return; }
    if (!next.seed) {
      const seedValues = new Uint32Array(1);
      if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(seedValues);
      else seedValues[0] = Date.now() >>> 0;
      next.seed = 'MUNGBANGGU-' + seedValues[0].toString(36).toUpperCase();
    }
    settings = next; runSettings = Object.assign({}, next);
    ui.load(settings); save(settings); visualSettings();
    physics = makePhysics(runSettings, names);
    resetEffects(); camera.enter(P.MAPS[runSettings.map], { reducedMotion: settings.reducedMotion });
    ui.setFocusMode(true);
    ui.clearError(); ui.hideResults(); ui.setStatus('countdown'); ui.setLocked(true);
    winner = null; status = 'countdown'; countdown = 3; countdownValue = null;
    accumulator = 0; leaderId = null; leadCooldown = 0; photoFinish = false;
    finalRanking = []; resultDelay = 0; resultShown = false;
    diagnostics.leadChanges = 0; diagnostics.photoFinishes = 0; diagnostics.events = {};
    audio.unlock(); resize();
  }
  function onChange() {
    const next = normalize(ui.readSettings());
    const needsPreview = status === 'idle' && (next.names !== settings.names || next.map !== settings.map || next.radius !== settings.radius || next.gravity !== settings.gravity || next.restitution !== settings.restitution || next.seed !== settings.seed || next.skills !== settings.skills);
    settings = next; save(settings); visualSettings();
    if (settings.sound) audio.unlock();
    if (needsPreview) preview();
    resize();
  }
  function finish() {
    status = 'finished'; photoFinish = false;
    finalRanking = physics.finished.slice();
    winner = P.chooseWinners(finalRanking, runSettings)[0];
    ui.setStatus('finished'); ui.setLocked(false);
    effects.celebrate(winner, P.THEMES[settings.theme]);
    audio.play('win'); resultDelay = 1.25;
  }
  function processEvents() {
    for (const event of physics.drainEvents()) {
      diagnostics.events[event.type] = (diagnostics.events[event.type] || 0) + 1;
      effects.handle(event, P.THEMES[settings.theme], physics.marbles.length);
      audio.play(event.type, event.intensity, event.skill);
      if (event.type === 'finish' && physics.finished.length === 1) ui.toast('첫 구슬이 결승에 도착했습니다');
    }
  }
  function updateRace(dt) {
    const map = P.MAPS[runSettings.map];
    const ranking = physics.getRanking();
    const active = ranking.filter(m => !m.finished);
    const close = !physics.finished.length && active.length >= 2 && active[0].y > map.finish.y - 340 && Math.abs(active[0].y - active[1].y) < 95;
    if (close && !photoFinish) {
      diagnostics.photoFinishes++;
      ui.toast('접전 · 마지막 순간을 천천히');
    }
    photoFinish = close;
    accumulator += dt * settings.speed * (photoFinish ? 0.32 : 1);
    let ticks = 0;
    while (accumulator >= STEP && ticks < 48 && !physics.complete) {
      physics.step(STEP); accumulator -= STEP; ticks++;
    }
    processEvents();
    const leader = physics.getRanking()[0];
    leadCooldown = Math.max(0, leadCooldown - dt);
    if (leader && leaderId !== leader.id) {
      if (leaderId !== null && leadCooldown === 0 && !leader.finished) {
        diagnostics.leadChanges++;
        ui.toast('선두 교체 · ' + leader.name);
        effects.handle({ type: 'lead', x: leader.x, y: leader.y, marble: leader, intensity: 1 }, P.THEMES[settings.theme], physics.marbles.length);
        audio.play('lead'); leadCooldown = 1.1;
      }
      leaderId = leader.id;
    }
    if (physics.complete) finish();
  }
  function frame(timestamp) {
    const dt = lastFrame ? Math.min(0.12, Math.max(0, (timestamp - lastFrame) / 1000)) : 1 / 60;
    lastFrame = timestamp;
    if (document.hidden) { lastFrame = 0; requestAnimationFrame(frame); return; }
    elapsedVisual += dt; hudElapsed += dt; fpsElapsed += dt; fpsFrames++; diagnostics.frames++;
    if (fpsElapsed >= 0.75) { fps = Math.round(fpsFrames / fpsElapsed); fpsElapsed = 0; fpsFrames = 0; }
    if (status === 'countdown') {
      countdown -= dt;
      const number = Math.max(1, Math.ceil(countdown));
      if (number !== countdownValue && countdown > 0) {
        countdownValue = number; ui.showCountdown(String(number)); audio.play('countdown');
        effects.burst(physics.map ? physics.map.width / 2 : 500, camera.y, P.THEMES[settings.theme].primary, 'countdown', 1);
      }
      if (countdown <= 0) { status = 'running'; ui.setStatus('running'); ui.hideCountdown(); ui.toast('출발 · 행운의 구슬이 굴러갑니다'); audio.play('go'); }
    } else if (status === 'running') updateRace(dt);
    else if (status === 'finished' && !resultShown) {
      resultDelay -= dt;
      if (resultDelay <= 0) {
        resultShown = true;
        ui.showResults({ winners: P.chooseWinners(finalRanking, runSettings), ranking: finalRanking, seed: runSettings.seed, time: physics.time, ruleLabel: P.ruleLabel(runSettings) });
      }
    }
    qualityCooldown -= dt;
    if (status === 'running' && fps < 45) lowFpsTime += dt;
    else lowFpsTime = Math.max(0, lowFpsTime - dt * 2);
    if (lowFpsTime > 3 && qualityCooldown <= 0 && settings.quality !== 'low') {
      settings.quality = QUALITY_ORDER[QUALITY_ORDER.indexOf(settings.quality) + 1];
      renderer.setQuality(settings.quality);
      if (effects.setQuality) effects.setQuality(settings.quality);
      ui.load(settings); ui.setLocked(true);
      save(settings); lowFpsTime = 0; qualityCooldown = 8; diagnostics.autoQualityDrops++;
      ui.toast('더 부드러운 플레이를 위해 비주얼 품질을 조절했습니다');
    }
    const map = P.MAPS[(runSettings || settings).map];
    const ranking = physics.getRanking();
    camera.viewport = ui.getViewport();
    camera.update(dt, physics, map, { photoFinish: photoFinish, status: status });
    effects.update(dt);
    renderer.render({ physics: physics, map: map, camera: camera, effects: effects, time: elapsedVisual, dt: dt, status: status, winner: winner, leader: ranking[0] || null, photoFinish: photoFinish });
    if (hudElapsed >= 0.1) {
      hudElapsed = 0;
      ui.updateHUD({ ranking: ranking, remaining: physics.marbles.length - physics.finished.length, total: physics.marbles.length, time: status === 'idle' ? 0 : physics.time, fps: fps, leader: ranking[0], seed: (runSettings || settings).seed, map: map, quality: settings.quality });
      renderer.drawMinimap(mini, physics, camera);
    }
    requestAnimationFrame(frame);
  }
  ui.on('start', () => start(false));
  ui.on('restart', () => start(true));
  ui.on('replay', () => { settings = normalize(ui.readSettings()); preview(); });
  ui.on('reset', () => { settings = normalize(ui.readSettings()); preview(); });
  ui.on('shuffle', () => {
    if (status === 'running' || status === 'countdown') return;
    try {
      const input = ui.readSettings().names;
      P.parseNames(input);
      const entries = input.split(/[,\n]+/).map(name => name.trim()).filter(Boolean);
      const seed = String(Date.now()) + '-shuffle';
      const random = P.seedRandom(seed);
      for (let i = entries.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); const swap = entries[i]; entries[i] = entries[j]; entries[j] = swap; }
      settings = normalize(ui.readSettings());
      settings.names = entries.join(',');
      ui.load(settings); save(settings); preview(); ui.toast('출발 순서를 섞었습니다');
    } catch (error) { ui.showError(error.message); }
  });
  ui.on('change', onChange);
  ui.on('theme', onChange);
  ui.on('layout', resize);
  ui.on('follow', () => { camera.follow = !camera.follow; camera.entrance = null; if (ui.setFollowing) ui.setFollowing(camera.follow); ui.toast(camera.follow ? '선두 추적을 켰습니다' : '자유롭게 코스를 둘러보세요'); });
  camera.attach(canvas);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { lastFrame = 0; });
  visualSettings(); preview();
  P.app = { ui: ui, renderer: renderer, camera: camera, effects: effects, audio: audio,
    get physics() { return physics; }, get status() { return status; }, get settings() { return Object.assign({}, settings); },
    get runSettings() { return runSettings && Object.assign({}, runSettings); },
    get diagnostics() { return Object.assign({}, diagnostics); }, start: start, reset: preview
  };
  requestAnimationFrame(frame);
})();

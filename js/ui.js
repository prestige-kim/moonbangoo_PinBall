(function (global) {
  'use strict';
  var P = global.CosmicPinball = global.CosmicPinball || {};
  var $ = function (id) { return document.getElementById(id); };
  function icon(id) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + id);
    svg.appendChild(use);
    return svg;
  }
  function formatTime(value, precise) {
    var sec = Math.max(0, Number(value) || 0);
    var mins = Math.floor(sec / 60);
    var seconds = Math.floor(sec % 60);
    var result = String(mins).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    return precise ? result + '.' + String(Math.floor((sec % 1) * 100)).padStart(2, '0') : result;
  }
  function UI() {
    this.handlers = {};
    this.rule = 'first';
    this.theme = 'cosmic';
    this.locked = false;
    this.rankingNodes = new Map();
    this.liveLeader = new P.LiveLeader();
    this.countAnimation = 0;
    this.displayCount = 6;
    this.totalCount = 6;
    this.previousFocus = null;
    this.resultData = null;
    this.following = true;
    this.focusMode = false;
    this.scene = null;
    this.sceneReveal = 0;
    this.status = 'intro';
    this.panelOpen = false;
    this.lastMobile = global.innerWidth <= 850;
    this.boundResize = this.onResize.bind(this);
    this.groupCounts = {};
    this.lastRound = null;
    try {
      var previous = JSON.parse(localStorage.getItem('mungbanggu-pinball-last-round') || 'null');
      if (previous && typeof previous.seed === 'string' && previous.seed && P.parseNames(previous.names).length) this.lastRound = previous;
    } catch (_) {}
    this.bind();
    $('reduced-motion').checked = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    document.documentElement.classList.toggle('reduced-motion', $('reduced-motion').checked);
    this.updateOutputs();
    this.updateParticipants();
    this.updatePanel();
    this.setScene(document.body.dataset.scene || 'intro');
    global.addEventListener('resize', this.boundResize);
  }
  UI.prototype.on = function (action, handler) {
    (this.handlers[action] || (this.handlers[action] = [])).push(handler);
    return this;
  };
  UI.prototype.emit = function (action, payload) {
    (this.handlers[action] || []).forEach(function (handler) { handler(payload); });
  };
  UI.prototype.bind = function () {
    var self = this;
    $('intro-start-button').addEventListener('click', function () {
      if (self.scene === 'intro') self.emit('enter');
    });
    this.bindSceneKeys();
    $('camera-out').addEventListener('click', function () { self.emit('camerazoom', 1 / 1.2); });
    $('camera-in').addEventListener('click', function () { self.emit('camerazoom', 1.2); });
    $('camera-home').addEventListener('click', function () { self.emit('camerahome'); });
    $('color-groups').addEventListener('click', function (event) {
      var button = event.target.closest('[data-color-group]');
      if (!button || self.locked) return;
      var id = button.dataset.colorGroup;
      if (self.groupCounts[id]) delete self.groupCounts[id];
      else if (self.groupTotal() < 500) self.groupCounts[id] = 1;
      self.commitGroups();
    });
    $('group-quantities').addEventListener('click', function (event) {
      var button = event.target.closest('[data-quantity]');
      if (!button || self.locked) return;
      var id = button.dataset.group, value = self.groupCounts[id] + Number(button.dataset.quantity);
      if (value >= 1 && self.groupTotal() + Number(button.dataset.quantity) <= 500) self.groupCounts[id] = value;
      self.commitGroups();
    });
    $('group-quantities').addEventListener('change', function (event) {
      if (self.locked || !event.target.dataset.group) return;
      self.groupCounts[event.target.dataset.group] = Number(event.target.value);
      self.commitGroups();
    });
    ['rank-minus', 'rank-plus'].forEach(function (id) {
      $(id).addEventListener('click', function () {
        if (self.locked) return;
        $('rank-n').value = Math.max(1, Math.min(self.groupTotal(), Number($('rank-n').value) + (id === 'rank-plus' ? 1 : -1)));
        $('seed').value = ''; self.syncSeed(); self.updateParticipants(); self.emit('change', self.readSettings());
      });
    });
    $('seed-auto').addEventListener('click', function () {
      if (self.locked) return;
      $('seed').value = ''; self.syncSeed(); self.emit('change', self.readSettings());
    });
    $('seed-previous').addEventListener('click', function () {
      if (self.locked || !self.lastRound) return;
      self.load(self.lastRound); self.emit('change', self.readSettings());
    });
    $('settings-form').addEventListener('submit', function (event) { event.preventDefault(); if (!self.locked && (self.scene === 'setup' || self.isGameScene())) self.emit('start'); });
    ['reset', 'restart', 'replay'].forEach(function (action) {
      if (!$(action + '-button')) return;
      $(action + '-button').addEventListener('click', function () {
        if (action === 'restart' || action === 'replay') self.hideResults();
        if (action === 'replay' && global.innerWidth <= 850) { self.panelOpen = true; self.updatePanel(); }
        self.emit(action);
      });
    });
    document.querySelectorAll('[data-rule]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (self.locked) return;
        self.rule = button.dataset.rule; $('seed').value = ''; self.syncSeed(); self.syncSelections(); self.clearError(); self.emit('change', self.readSettings());
      });
    });

    $('settings-form').addEventListener('input', function (event) {
      $('seed').value = ''; self.syncSeed();
      self.updateOutputs();
      if (event.target.id === 'names') { self.updateParticipants(); self.clearError(); }
      if (event.target.id === 'rank-n') self.clearError();
      if (event.target.id === 'names' || event.target.id === 'seed' || event.target.id === 'rank-n') return;
      if (event.target.hasAttribute('data-physical')) return;
      self.emit('change', self.readSettings());
    });
    $('settings-form').addEventListener('change', function (event) {
      if (event.target.closest('[data-group]')) return;
      $('seed').value = ''; self.syncSeed();
      self.updateOutputs(); self.updateParticipants();
      if (event.target.id === 'sound') self.syncSound();
      self.emit('change', self.readSettings());
    });
    $('sound-toggle').addEventListener('click', function () {
      $('sound').checked = !$('sound').checked; self.syncSound(); self.emit('change', self.readSettings());
    });
    ['settings-toggle', 'mobile-setup-button', 'panel-close'].forEach(function (id) {
      $(id).addEventListener('click', function () {
        if (self.scene === 'setup') { if (id === 'panel-close') self.emit('setupcancel'); return; }
        self.panelOpen = id === 'panel-close' ? false : !self.panelOpen; self.updatePanel();
      });
    });
    $('stop-button').addEventListener('click', function () { if (self.scene === 'running' && !$('stop-button').hidden) self.emit('stop'); });
    $('follow-button').addEventListener('click', function () { self.setFollowing(!self.following); self.emit('follow'); });
    $('game-canvas').addEventListener('followchange', function (event) { self.setFollowing(!!event.detail); });
    $('results-close').addEventListener('click', function () { self.hideResults(); });
    $('results-dialog').addEventListener('cancel', function (event) { event.preventDefault(); self.hideResults(); });
    $('results-dialog').addEventListener('click', function (event) {
      if (event.target !== this) return;
      var bounds = this.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) self.hideResults();
    });
    $('show-all-results').addEventListener('click', function () { self.renderResults(true); });
    document.addEventListener('keydown', function (event) {
      if (self.isGameScene() && event.key === 'Escape' && !$('results-dialog').open && self.panelOpen && global.innerWidth <= 850) { self.panelOpen = false; self.updatePanel(); }
    });
  };
  UI.prototype.readSettings = function () {
    return {
      names: $('names').value, rule: this.rule, rankN: Number($('rank-n').value),
      map: 'classic', theme: this.theme, radius: Number($('radius').value),
      gravity: Number($('gravity').value), restitution: Number($('restitution').value),
      speed: Number($('speed').value), sound: $('sound').checked, volume: Number($('volume').value),
      quality: $('quality').value, seed: $('seed').value, skills: $('skills').checked,
      reducedMotion: $('reduced-motion').checked,
      replayStart: $('seed').value && this.lastRound && $('seed').value === this.lastRound.seed ? this.lastRound.replayStart || null : null
    };
  };
  UI.prototype.load = function (settings) {
    if (!settings) return;
    ['names', 'radius', 'gravity', 'restitution', 'speed', 'volume', 'quality', 'seed'].forEach(function (id) {
      if (settings[id] !== undefined) $(id).value = settings[id];
    });
    this.groupCounts = P.colorSelection(settings.names);
    $('names').value = P.colorNames(this.groupCounts);
    this.renderGroups(); this.updateParticipants();
    if (!this.lastRound) $('seed').value = '';
    this.syncSeed();
    if (settings.rankN !== undefined) $('rank-n').value = settings.rankN;
    ['sound', 'skills'].forEach(function (id) { if (settings[id] !== undefined) $(id).checked = !!settings[id]; });
    if (settings.reducedMotion !== undefined) $('reduced-motion').checked = !!settings.reducedMotion;
    this.rule = settings.rule || this.rule;
    this.setTheme(settings.theme || this.theme);
    this.syncSelections(); this.syncSound(); this.updateOutputs(); this.updateParticipants();
  };
  UI.prototype.setTheme = function () {
    this.theme = 'cosmic';
    document.body.dataset.theme = this.theme;
    this.syncSelections();
  };
  UI.prototype.syncSelections = function () {
    var self = this;
    [['data-rule', this.rule]].forEach(function (pair) {
      document.querySelectorAll('[' + pair[0] + ']').forEach(function (button) {
        var active = button.getAttribute(pair[0]) === pair[1]; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
      });
    });
    var hasN = this.rule === 'nth' || this.rule === 'top';
    $('rank-n-row').hidden = !hasN;
    $('rank-n-label').textContent = this.rule === 'top' ? '당첨 인원' : '당첨 순위';
    $('rank-n-unit').textContent = this.rule === 'top' ? '명' : '번째';
  };
  UI.prototype.syncSound = function () {
    var enabled = $('sound').checked;
    $('sound-toggle').setAttribute('aria-pressed', String(enabled));
    $('sound-toggle').setAttribute('aria-label', enabled ? '음악과 효과음 끄기' : '음악과 효과음 켜기');
    $('sound-toggle').replaceChildren(icon(enabled ? 'sound' : 'mute'));
  };
  UI.prototype.updateOutputs = function () {
    $('radius-value').textContent = $('radius').value;
    $('gravity-value').textContent = $('gravity').value;
    $('restitution-value').textContent = Number($('restitution').value).toFixed(2);
    $('speed-value').textContent = Number($('speed').value).toFixed(2).replace(/0$/, '') + '×';
    $('volume-value').textContent = Math.round(Number($('volume').value) * 100) + '%';
    document.documentElement.classList.toggle('reduced-motion', $('reduced-motion').checked);
  };
  UI.prototype.groupTotal = function () {
    return Object.values(this.groupCounts || {}).reduce(function (sum, count) { return sum + count; }, 0);
  };
  UI.prototype.renderGroups = function () {
    var self = this, focus = document.activeElement && document.activeElement.id;
    $('color-groups').replaceChildren(); $('group-quantities').replaceChildren();
    P.COLOR_GROUPS.forEach(function (group) {
      var count = self.groupCounts[group.id] || 0;
      var button = document.createElement('button'); button.type = 'button'; button.id = 'group-' + group.id;
      button.dataset.colorGroup = group.id; button.className = 'color-group';
      button.setAttribute('aria-pressed', String(count > 0)); button.disabled = self.locked || (!count && self.groupTotal() >= 500);
      var swatch = document.createElement('span'); swatch.className = 'color-swatch'; swatch.style.backgroundColor = group.color; swatch.setAttribute('aria-hidden', 'true');
      button.append(swatch, document.createTextNode(group.name)); $('color-groups').append(button);
      if (!count) return;
      var row = document.createElement('div'); row.className = 'group-quantity';
      var label = document.createElement('label'); label.htmlFor = 'quantity-' + group.id; label.textContent = group.name;
      var control = document.createElement('div'); control.className = 'quantity-control';
      [-1, 1].forEach(function (delta) {
        var step = document.createElement('button'); step.type = 'button'; step.id = 'quantity-' + group.id + (delta < 0 ? '-minus' : '-plus');
        step.dataset.group = group.id; step.dataset.quantity = delta; step.textContent = delta < 0 ? '−' : '+';
        step.setAttribute('aria-label', group.name + (delta < 0 ? ' 수량 줄이기' : ' 수량 늘리기'));
        step.disabled = self.locked || (delta < 0 ? count === 1 : self.groupTotal() >= 500);
        if (delta < 0) control.append(step);
        else {
          var select = document.createElement('select'); select.id = 'quantity-' + group.id; select.dataset.group = group.id; select.disabled = self.locked;
          for (var n = 1; n <= 500 - self.groupTotal() + count; n++) { var option = document.createElement('option'); option.value = n; option.textContent = n + '개'; select.append(option); }
          select.value = count; control.append(select, step);
        }
      });
      row.append(label, control); $('group-quantities').append(row);
    });
    if (focus && $(focus) && !$(focus).disabled) $(focus).focus({ preventScroll: true });
  };
  UI.prototype.commitGroups = function () {
    $('names').value = P.colorNames(this.groupCounts);
    $('seed').value = ''; this.syncSeed();
    this.renderGroups(); this.clearError(); this.updateParticipants(); this.emit('change', this.readSettings());
  };
  UI.prototype.syncSeed = function () {
    var replay = !!$('seed').value;
    $('seed-auto').setAttribute('aria-pressed', String(!replay)); $('seed-auto').classList.toggle('active', !replay);
    $('seed-previous').setAttribute('aria-pressed', String(replay)); $('seed-previous').classList.toggle('active', replay);
    $('seed-auto').disabled = this.locked;
    $('seed-previous').disabled = this.locked || !this.lastRound || !this.lastRound.replayStart;
    $('seed-note').textContent = replay ? '직전 시드·멤버·설정과 실제 출발 위치를 복원해 같은 결과를 재현합니다.' : '매번 새로운 출발로 시작합니다.';
  };
  UI.prototype.rememberRound = function (settings) {
    this.lastRound = Object.assign({}, settings);
    try { localStorage.setItem('mungbanggu-pinball-last-round', JSON.stringify(this.lastRound)); } catch (_) {}
    this.syncSeed();
  };
  UI.prototype.updateParticipants = function () {
    var count = this.groupTotal(), selected = Object.keys(this.groupCounts || {}).length;
    $('participant-count').textContent = count; $('mobile-count').textContent = count;
    $('names-help').textContent = selected + '개 그룹 · 총 ' + count + '개 / 최대 500개';
    var rank = Math.max(1, Math.min(count || 1, Number($('rank-n').value) || 1));
    $('rank-n').replaceChildren();
    for (var n = 1; n <= Math.max(1, count); n++) { var option = document.createElement('option'); option.value = n; option.textContent = n; $('rank-n').append(option); }
    $('rank-n').value = rank;
    $('rank-minus').disabled = this.locked || rank <= 1; $('rank-plus').disabled = this.locked || rank >= count;
    $('start-button').disabled = this.locked || !count;
    if (!this.locked) $('start-button').querySelector('small').textContent = count ? '총 ' + count + '개의 핀볼을 섞고 발사합니다' : '색상 그룹을 하나 이상 선택해 주세요';
  };
  UI.prototype.updateStartCopy = function () {
    var stages = {
      mixing: ['핀볼을 섞고 있어요', '유리 대포 속에서 새로운 자리를 찾는 중'],
      aiming: ['출발선을 향하고 있어요', '핀볼을 발사할 준비를 합니다'],
      flight: ['핀볼을 발사하고 있어요', '핀볼이 도착하면 놀이판이 펼쳐집니다'],
      running: ['게임 진행 중', '마지막 핀볼까지 천천히 지켜봐 주세요']
    };
    var count = this.groupTotal();
    var copy = this.locked ? (stages[this.scene] || stages.mixing) : ['게임 시작', count ? '총 ' + count + '개의 핀볼을 섞고 발사합니다' : '색상 그룹을 하나 이상 선택해 주세요'];
    $('start-button').querySelector('span:nth-child(2)').firstChild.textContent = copy[0];
    $('start-button').querySelector('small').textContent = copy[1];
  };
  UI.prototype.setLocked = function (value) {
    this.locked = !!value;
    document.querySelectorAll('[data-physical], [data-rule], #names, #rank-n, #rank-minus, #rank-plus, #seed-auto, #seed-previous').forEach(function (control) { control.disabled = !!value; });
    if (P.COLOR_GROUPS && this.groupCounts) this.renderGroups();
    if (this.groupCounts) { this.updateParticipants(); this.syncSeed(); }
    else $('start-button').disabled = !!value;
    this.updateStartCopy();
    if (value && this.isGameScene() && global.innerWidth <= 850 && this.panelOpen) { this.panelOpen = false; this.updatePanel(); }
  };
  UI.prototype.setStatus = function (status) {
    this.status = status;
    document.body.dataset.status = status;
    this.updateStartCopy();
    if (status === 'setup' || status === 'running') this.setFollowing(true);
  };
  UI.prototype.setFollowing = function (value) {
    this.following = !!value;
    $('follow-button').classList.toggle('active', this.following); $('follow-button').setAttribute('aria-pressed', String(this.following));
  };
  UI.prototype.onResize = function () {
    var mobile = global.innerWidth <= 850;
    if (mobile !== this.lastMobile) { this.panelOpen = this.scene === 'setup' || (this.isGameScene() && !mobile && !this.focusMode); this.lastMobile = mobile; this.updatePanel(); }
  };
  UI.prototype.isGameScene = function () { return this.scene === 'running' || this.scene === 'finished'; };
  UI.prototype.updatePanel = function () {
    var mobile = global.innerWidth <= 850;
    var open = this.scene === 'setup' || (this.isGameScene() && this.panelOpen);
    $('setup-panel').classList.toggle('mobile-open', mobile && open);
    $('setup-panel').classList.toggle('is-collapsed', !open);
    $('setup-panel').setAttribute('aria-hidden', String(!open));
    $('setup-panel').inert = !open;
    document.body.classList.toggle('mobile-sheet-open', mobile && open && this.isGameScene());
    document.body.classList.toggle('panel-collapsed', !mobile && !open);
    $('settings-toggle').setAttribute('aria-expanded', String(open));
    $('mobile-setup-button').setAttribute('aria-expanded', String(open));
    this.emit('layout');
    var self = this;
    global.setTimeout(function () { self.emit('layout'); }, 430);
  };
  UI.prototype.getSetupControls = function () {
    return Array.from($('setup-panel').querySelectorAll('button,input,textarea,select,summary,[tabindex]')).filter(function (control) {
      return !control.disabled && control.tabIndex >= 0 && control.getClientRects().length > 0;
    });
  };
  UI.prototype.bindSceneKeys = function () {
    var self = this;
    document.addEventListener('keydown', function (event) {
      if (self.isGameScene()) return;
      if (event.key === 'Escape' && self.scene === 'setup') {
        event.preventDefault(); event.stopImmediatePropagation(); self.emit('setupcancel'); return;
      }
      if (event.key !== 'Tab') return;
      var controls = self.scene === 'setup' ? self.getSetupControls() : (self.scene === 'intro' ? [$('intro-start-button')] : []);
      if (!controls.length) { event.preventDefault(); $(self.scene === 'mixing' ? 'cinema-canvas' : 'game-canvas').focus({ preventScroll: true }); return; }
      var index = controls.indexOf(document.activeElement);
      if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === controls.length - 1)) {
        event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0].focus({ preventScroll: true });
      }
    }, true);
  };
  UI.prototype.syncSceneAccess = function () {
    var game = this.isGameScene(), setup = this.scene === 'setup';
    var main = document.querySelector('main');
    main.inert = false; main.removeAttribute('aria-hidden');
    document.querySelectorAll('.masthead,.system-footer').forEach(function (element) {
      element.inert = !game;
      if (!game) element.setAttribute('aria-hidden', 'true'); else element.removeAttribute('aria-hidden');
    });
    Array.from(main.children).forEach(function (element) {
      if (element.id === 'setup-panel') return;
      element.inert = !game;
      if (!game) element.setAttribute('aria-hidden', 'true'); else element.removeAttribute('aria-hidden');
    });
    var panel = $('setup-panel'), open = setup || (game && this.panelOpen);
    panel.inert = !open; panel.setAttribute('aria-hidden', String(!open));
    if (setup) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'setup-title'); }
    else { panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); panel.removeAttribute('aria-labelledby'); }
    $('scene-welcome').inert = this.scene !== 'intro';
    $('scene-welcome').setAttribute('aria-hidden', String(this.scene !== 'intro'));
    $('game-canvas').setAttribute('aria-hidden', String(!game));
    $('cinema-canvas').setAttribute('aria-hidden', String(this.scene !== 'mixing'));
    $('scene-status').setAttribute('aria-hidden', String(['mixing','aiming','flight'].indexOf(this.scene) < 0));
  };
  UI.prototype.setScene = function (stage) {
    var states = ['intro','setup','mixing','aiming','flight','running','finished'];
    if (states.indexOf(stage) < 0) stage = 'intro';
    var previous = this.scene, self = this;
    this.scene = stage; document.body.dataset.scene = stage;
    if (stage !== 'running') this.setStopAvailable(false);
    if (!this.isGameScene()) this.focusMode = stage !== 'intro' && stage !== 'setup';
    else if (previous !== 'running' && previous !== 'finished') this.focusMode = true;
    document.body.classList.toggle('focus-mode', this.focusMode);
    states.forEach(function (name) { document.body.classList.toggle('scene-' + name, stage === name); });
    document.body.classList.remove('intro-active','launch-active');
    if (!this.isGameScene()) this.panelOpen = stage === 'setup';
    else if (previous !== 'running' && previous !== 'finished') this.panelOpen = false;
    this.updatePanel(); this.syncSceneAccess(); this.setStatus(stage);
    this.setSceneProgress({ reveal: this.isGameScene() ? 1 : 0 });
    $('scene-status').textContent = '';
    if (!this.isGameScene()) { this.hideResults(); this.hideCountdown(); }
    if (stage === 'setup' && previous !== stage && this.liveLeader) this.liveLeader = new P.LiveLeader();
    if (stage === 'intro' && previous !== stage) $('intro-start-button').focus({ preventScroll: true });
    else if (stage === 'setup' && previous !== stage) {
      requestAnimationFrame(function () { if (self.scene !== 'setup') return; var next = $('group-red'); if (next) next.focus({ preventScroll: true }); });
    } else if (['mixing','aiming','flight'].indexOf(stage) >= 0 && previous !== stage) $(stage === 'mixing' ? 'cinema-canvas' : 'game-canvas').focus({ preventScroll: true });
    else if (stage === 'running' && previous !== 'running') $('game-canvas').focus({ preventScroll: true });
  };
  UI.prototype.setSceneProgress = function (payload) {
    var reveal = payload && Number(payload.reveal);
    if (!Number.isFinite(reveal)) return;
    this.sceneReveal = Math.max(0, Math.min(1, reveal));
    document.body.style.setProperty('--scene-reveal', String(this.sceneReveal));
    document.body.style.setProperty('--hud-reveal', String(Math.max(0, (this.sceneReveal - .85) / .15)));
  };
  UI.prototype.setFocusMode = function (value) {
    this.focusMode = !!value;
    document.body.classList.toggle('focus-mode', this.focusMode);
    if (this.focusMode) this.panelOpen = false;
    else if (global.innerWidth > 850) this.panelOpen = true;
    this.updatePanel();
  };
  UI.prototype.getViewport = function () {
    var width = global.innerWidth, height = global.innerHeight;
    var panel = $('setup-panel').getBoundingClientRect();
    var top = document.querySelector('.masthead').getBoundingClientRect().bottom + 20;
    var bottom = height - 35;
    var stop = $('stop-button');
    if (stop && !stop.hidden) {
      var stopRect = stop.getBoundingClientRect();
      if (stopRect.width > 0 && stopRect.top > top) bottom = Math.min(bottom, stopRect.top - 18);
    }
    if (width <= 850) {
      var launch = $('mobile-setup-button').getBoundingClientRect();
      bottom = Math.min(bottom, launch.top - 18);
      if (this.isGameScene() && this.panelOpen && panel.top < bottom && panel.bottom > top) bottom = Math.max(top + 90, panel.top - 18);
      var raceMobile = document.querySelector('.race-panel').getBoundingClientRect();
      // A narrow portrait screen has room beneath the HUD. Keep the tracked
      // marble there even when it rolls to the right side of the board.
      if (width <= 500 && raceMobile.width > 0 && bottom - raceMobile.bottom > 160) top = Math.max(top, raceMobile.bottom + 12);
      // On short landscape screens the race HUD covers the central play band.
      // Reserve its horizontal space during the flight too, so the landing pose
      // and live camera use the same coordinates.
      var focusY = top + (bottom - top) / 2;
      var rightMobile = raceMobile.width > 0 && raceMobile.top < focusY + 30 && raceMobile.bottom > focusY - 30
        ? Math.min(width - 14, raceMobile.left - 18) : width - 14;
      var mini = document.querySelector('.minimap-panel').getBoundingClientRect();
      if (mini.width > 0 && mini.left < rightMobile && mini.right > 14 && mini.top < bottom && mini.bottom > top) bottom = Math.min(bottom, mini.top - 12);
      return { x: 14, y: top, w: Math.max(100, rightMobile - 14), h: Math.max(90, bottom - top) };
    }
    // Sliding panels contribute only their currently visible part, including during focus transitions.
    var left = this.isGameScene() && this.panelOpen && panel.right > 0 && panel.left < width ? Math.max(32, panel.right + 25) : 32;
    var race = document.querySelector('.race-panel').getBoundingClientRect();
    var right = race.width > 0 ? race.left - 25 : width - 32;
    return { x: left, y: top, w: Math.max(160, right - left), h: Math.max(1, bottom - top) };
  };
  UI.prototype.colorFor = function (marble, total) {
    if (P.Pinball) return P.Pinball.group(marble.name).color;
    if (marble.color) return marble.color;
    if (P.marbleColor && P.THEMES && P.THEMES[this.theme]) return P.marbleColor(marble.colorIndex || 0, Math.max(1, total || this.totalCount), P.THEMES[this.theme]);
    return 'hsl(' + ((marble.colorIndex || 0) * 57 + 250) + ',75%,70%)';
  };
  UI.prototype.setStopAvailable = function (available) {
    var visible = this.scene === 'running' && available;
    if ($('stop-button').hidden === !visible) return;
    $('stop-button').hidden = !visible;
    document.body.classList.toggle('can-stop', visible);
    this.emit('layout');
  };
  UI.prototype.updateHUD = function (data) {
    var self = this;
    if (typeof data.total === 'number') this.totalCount = data.total;
    if (typeof data.remaining === 'number') {
      var target = data.remaining;
      if (target !== this.countTarget) {
        this.countTarget = target; cancelAnimationFrame(this.countAnimation);
        var from = this.displayCount, start = performance.now();
        var animate = function (now) {
          var ratio = document.documentElement.classList.contains('reduced-motion') ? 1 : Math.min(1, (now - start) / 240);
          self.displayCount = from + (target - from) * (1 - Math.pow(1 - ratio, 3));
          self.writeRemaining(Math.round(self.displayCount));
          if (ratio < 1) self.countAnimation = requestAnimationFrame(animate);
        };
        this.countAnimation = requestAnimationFrame(animate);
      } else this.writeRemaining(Math.round(this.displayCount));
    }
    if (typeof data.time === 'number') {
      if(!this.elapsedParts){
        this.elapsedParts={text:document.createTextNode(''),small:document.createElement('small')};
        $('elapsed').replaceChildren(this.elapsedParts.text,this.elapsedParts.small);
      }
      var seconds=formatTime(data.time,false),fraction='.'+String(Math.floor((Math.max(0,data.time)%1)*100)).padStart(2,'0');
      if(this.elapsedParts.text.textContent!==seconds)this.elapsedParts.text.textContent=seconds;
      if(this.elapsedParts.small.textContent!==fraction)this.elapsedParts.small.textContent=fraction;
    }
    if (data.fps !== undefined) $('fps').textContent = Math.round(data.fps);
    if (Array.isArray(data.ranking)) this.renderRanking(data.ranking.slice(0, 5));
  };
  UI.prototype.writeRemaining = function (count) {
    var key=count+'|'+this.totalCount;if(this.remainingKey===key)return;this.remainingKey=key;
    var total = document.createElement('span'); total.textContent = ' / ' + this.totalCount;
    $('remaining').replaceChildren(document.createTextNode(String(count)), total);
  };
  UI.prototype.renderRanking = function (ranking) {
    var list = $('live-ranking'), self = this;
    if (!ranking.length) { this.rankingNodes.clear(); list.replaceChildren(); this.liveLeader = new P.LiveLeader(); return; }
    var leader = this.liveLeader.update(ranking, (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000);
    var shown = ranking.slice(), standing = P.raceStanding(ranking);
    if (leader && !ranking[0].finished) shown = [leader].concat(ranking.filter(function (m) { return m.id !== leader.id; }));
    if (list.querySelector('.ranking-empty')) list.replaceChildren();
    shown.forEach(function (marble, index) {
      var key = 'slot-' + index, row = self.rankingNodes.get(key);
      if (!row) {
        row = document.createElement('li'); row.className = 'ranking-item';
        ['rank-number', 'rank-marble', 'rank-name', 'rank-finish'].forEach(function (cls) { var span = document.createElement('span'); span.className = cls; row.appendChild(span); });
        self.rankingNodes.set(key, row); list.appendChild(row);
      }
      var changed = row.dataset.marbleId !== String(marble.id), previousName = row.children[2].textContent;
      var rankText=index===0&&leader&&!marble.finished?'선두':String(standing.ranks[ranking.indexOf(marble)]).padStart(2,'0');
      if(row.children[0].textContent!==rankText)row.children[0].textContent=rankText;
      var color=self.colorFor(marble),detail=marble.name+'|'+marble.copy+'|'+marble.copies;
      if(changed)row.dataset.marbleId=String(marble.id);
      if(row.dataset.color!==color){row.children[1].style.setProperty('--marble-color',color);row.dataset.color=color;}
      if(row.dataset.detail!==detail){
        row.children[2].textContent=marble.name;
        row.children[2].title=marble.name+(marble.copies>1?' · '+marble.copy+'/'+marble.copies:'');
        row.dataset.detail=detail;
      }
      if (row.dataset.finished !== String(marble.finished)) {
        row.children[3].replaceChildren(); if (marble.finished) row.children[3].appendChild(icon('check'));
        row.dataset.finished = String(marble.finished);
      }
      if (changed && previousName !== marble.name && previousName && row.animate && !document.documentElement.classList.contains('reduced-motion')) {
        if (row._transition) row._transition.cancel();
        row._transition = row.animate([{ opacity: .65 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
      }
    });
    this.rankingNodes.forEach(function (node, key) { if (Number(key.slice(5)) >= shown.length) { node.remove(); self.rankingNodes.delete(key); } });
  };
  UI.prototype.showCountdown = function (value) {
    $('countdown').hidden = false; $('countdown-value').textContent = value;
    if (!document.documentElement.classList.contains('reduced-motion')) {
      ['countdown-value', null].forEach(function (id) { var node = id ? $(id) : document.querySelector('.countdown-ring'); node.style.animation = 'none'; void node.offsetWidth; node.style.animation = ''; });
    }
  };
  UI.prototype.hideCountdown = function () { $('countdown').hidden = true; };
  UI.prototype.toast = function (message) {
    var stack = $('toast-stack');
    while (stack.children.length >= 3) stack.firstChild.remove();
    var toast = document.createElement('div'); toast.className = 'toast'; toast.appendChild(icon('spark'));
    var text = document.createElement('span'); text.textContent = String(message); toast.appendChild(text); stack.appendChild(toast);
    global.setTimeout(function () { toast.classList.add('is-leaving'); global.setTimeout(function () { toast.remove(); }, 320); }, 3200);
  };
  UI.prototype.showError = function (message) {
    $('input-error').textContent = message; $('input-error').hidden = false;
    $('names').setAttribute('aria-invalid', 'true');
    this.panelOpen = true; this.updatePanel();
    $('input-error').scrollIntoView({ behavior: document.documentElement.classList.contains('reduced-motion') ? 'auto' : 'smooth', block: 'nearest' });
  };
  UI.prototype.clearError = function () { $('input-error').hidden = true; $('input-error').textContent = ''; $('names').removeAttribute('aria-invalid'); };
  UI.prototype.showResults = function (data) {
    this.resultData = data;
    var winners = Array.isArray(data.winners) ? data.winners : [];
    $('winner-heading').textContent = winners.length > 3 ? winners.length + '명 당첨' : (winners.length ? winners.map(function (winner) { return winner.name; }).join(' · ') : (data.stoppedEarly ? '도착 결과' : '당첨 결과'));
    $('winner-heading').classList.remove('winner-reveal'); void $('winner-heading').offsetWidth; $('winner-heading').classList.add('winner-reveal');
    $('result-rule').textContent = (data.ruleLabel || '1등 당첨') + (data.stoppedEarly && !winners.length ? ' · 미확정' : '');
    document.querySelector('.winner-subtitle').textContent = winners.length ? '축하드립니다!' : '경기를 종료했습니다';
    $('result-ranking-title').textContent = data.stoppedEarly ? '도착 순위' : '최종 순위';
    $('result-note').hidden = !data.stoppedEarly;
    $('result-note').textContent = data.stoppedEarly ? '도착한 공의 순위만 표시합니다.' + (!winners.length ? ' 선택한 당첨 조건이 충족되지 않아 당첨은 미확정입니다.' : '') : '';
    $('result-time').textContent = formatTime(data.time, true);
    $('result-total').textContent = data.stoppedEarly ? (data.ranking || []).length + ' / ' + data.total + '개 도착' : (data.ranking || []).length + '개 핀볼';
    this.renderResults(false);
    this.previousFocus = document.activeElement;
    if (!$('results-dialog').open) $('results-dialog').showModal();
    $('restart-button').focus({ preventScroll: true });
  };
  UI.prototype.renderResults = function (all) {
    var self = this, data = this.resultData;
    if (!data) return;
    var ranking = data.ranking || [], winners = data.winners || [], winnerIds = new Set(winners.map(function (item) { return item.id; }));
    var shown = all ? ranking : ranking.slice(0, 8);
    $('result-ranking').replaceChildren();
    shown.forEach(function (marble, index) {
      var row = document.createElement('li'); row.className = 'result-row'; row.style.setProperty('--delay', Math.min(index, 7) * 45 + 'ms');
      if (winnerIds.has(marble.id)) row.classList.add('is-winner');
      var rank = document.createElement('span'); rank.className = 'rank-number'; rank.textContent = String(index + 1).padStart(2, '0');
      var ball = document.createElement('span'); ball.className = 'rank-marble'; ball.style.setProperty('--marble-color', self.colorFor(marble, ranking.length));
      var name = document.createElement('span'); name.className = 'rank-name'; name.textContent = marble.name; name.title = marble.name;
      var time = document.createElement('span'); time.className = 'rank-finish'; time.textContent = marble.finishTime !== null && marble.finishTime !== undefined ? formatTime(marble.finishTime, true) : '완주';
      row.append(rank, ball, name, time); $('result-ranking').appendChild(row);
    });
    $('show-all-results').hidden = all || ranking.length <= 8;
    $('show-all-results').textContent = '전체 ' + ranking.length + '개 순위 보기';
  };
  UI.prototype.hideResults = function () {
    if ($('results-dialog').open) {
      $('results-dialog').close();
      if (this.previousFocus && this.previousFocus.isConnected && !this.previousFocus.disabled) this.previousFocus.focus({ preventScroll: true });
    }
  };
  P.UI = UI;
})(window);

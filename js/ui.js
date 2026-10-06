(function (global) {
  'use strict';
  var P = global.CosmicPinball = global.CosmicPinball || {};
  var $ = function (id) { return document.getElementById(id); };
  var mapLabels = {
    classic: { number: '01', title: '자개 핀 보드', tag: '작은 장애물 사이로' },
    dynamic: { number: '02', title: '금박 회전길', tag: '빙글빙글 천천히' },
    hybrid: { number: '03', title: '행운 갈림길', tag: '같은 글자의 포털로 이동' }
  };
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
    this.map = 'classic';
    this.theme = 'cosmic';
    this.locked = false;
    this.rankingNodes = new Map();
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
    document.addEventListener('keydown', function (event) {
      if (!self.isGameScene() && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'f') { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    this.bindSceneKeys();
    $('settings-form').addEventListener('submit', function (event) { event.preventDefault(); if (!self.locked && (self.scene === 'setup' || self.isGameScene())) self.emit('start'); });
    ['shuffle', 'reset', 'restart', 'replay'].forEach(function (action) {
      $(action + '-button').addEventListener('click', function () {
        if (action === 'restart' || action === 'replay') self.hideResults();
        if (action === 'replay' && global.innerWidth <= 850) { self.panelOpen = true; self.updatePanel(); }
        self.emit(action);
      });
    });
    document.querySelectorAll('[data-rule]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (self.locked) return;
        self.rule = button.dataset.rule; self.syncSelections(); self.clearError(); self.emit('change', self.readSettings());
      });
    });
    document.querySelectorAll('[data-map]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (self.locked) return;
        self.map = button.dataset.map; self.syncSelections(); self.emit('change', self.readSettings());
      });
    });
    document.querySelectorAll('[data-theme-choice]').forEach(function (button) {
      button.addEventListener('click', function () {
        self.setTheme(button.dataset.themeChoice); self.emit('theme', self.readSettings());
      });
    });
    $('settings-form').addEventListener('input', function (event) {
      self.updateOutputs();
      if (event.target.id === 'names') { self.updateParticipants(); self.clearError(); }
      if (event.target.id === 'rank-n') self.clearError();
      if (event.target.id === 'names' || event.target.id === 'seed' || event.target.id === 'rank-n') return;
      if (event.target.hasAttribute('data-physical')) return;
      self.emit('change', self.readSettings());
    });
    $('settings-form').addEventListener('change', function (event) {
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
      map: this.map, theme: this.theme, radius: Number($('radius').value),
      gravity: Number($('gravity').value), restitution: Number($('restitution').value),
      speed: Number($('speed').value), sound: $('sound').checked, volume: Number($('volume').value),
      quality: $('quality').value, seed: $('seed').value, skills: $('skills').checked,
      reducedMotion: $('reduced-motion').checked
    };
  };
  UI.prototype.load = function (settings) {
    if (!settings) return;
    ['names', 'radius', 'gravity', 'restitution', 'speed', 'volume', 'quality', 'seed'].forEach(function (id) {
      if (settings[id] !== undefined) $(id).value = settings[id];
    });
    if (settings.rankN !== undefined) $('rank-n').value = settings.rankN;
    ['sound', 'skills'].forEach(function (id) { if (settings[id] !== undefined) $(id).checked = !!settings[id]; });
    if (settings.reducedMotion !== undefined) $('reduced-motion').checked = !!settings.reducedMotion;
    this.rule = settings.rule || this.rule;
    this.map = settings.map || this.map;
    this.setTheme(settings.theme || this.theme);
    this.syncSelections(); this.syncSound(); this.updateOutputs(); this.updateParticipants();
  };
  UI.prototype.setTheme = function (id) {
    this.theme = ['cosmic', 'candy', 'gold', 'ice'].indexOf(id) >= 0 ? id : 'cosmic';
    document.body.dataset.theme = this.theme;
    this.syncSelections();
  };
  UI.prototype.syncSelections = function () {
    var self = this;
    [['data-rule', this.rule], ['data-map', this.map], ['data-theme-choice', this.theme]].forEach(function (pair) {
      document.querySelectorAll('[' + pair[0] + ']').forEach(function (button) {
        var active = button.getAttribute(pair[0]) === pair[1]; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
      });
    });
    var hasN = this.rule === 'nth' || this.rule === 'top';
    $('rank-n-row').hidden = !hasN;
    $('rank-n-label').textContent = this.rule === 'top' ? '당첨 인원' : '당첨 순위';
    $('rank-n-unit').textContent = this.rule === 'top' ? '명' : '번째';
    var meta = mapLabels[self.map] || mapLabels.classic;
    $('map-number').textContent = meta.number; $('map-title').textContent = meta.title; $('map-tag').textContent = meta.tag;
  };
  UI.prototype.syncSound = function () {
    var enabled = $('sound').checked;
    $('sound-toggle').setAttribute('aria-pressed', String(enabled));
    $('sound-toggle').setAttribute('aria-label', enabled ? '효과음 끄기' : '효과음 켜기');
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
  UI.prototype.updateParticipants = function () {
    var count = 0;
    try {
      if (P.parseNames) count = P.parseNames($('names').value).length;
      else $('names').value.split(/[,\n]+/).forEach(function (entry) { var match = entry.trim().match(/^(.*?)(?:\*(\d+))?$/); if (match && match[1]) count += match[2] ? Number(match[2]) : 1; });
    } catch (_) { count = null; }
    $('participant-count').textContent = count === null ? '—' : count;
    $('mobile-count').textContent = count === null ? '—' : count;
    $('ready-label').textContent = count === null ? '입력 내용을 확인해 주세요' : count + '개의 구슬이 준비됐어요';
  };
  UI.prototype.updateStartCopy = function () {
    var stages = {
      mixing: ['구슬을 섞고 있어요', '유리 대포 속에서 새로운 자리를 찾는 중'],
      aiming: ['출발선을 향하고 있어요', '오늘의 작은 행운을 보낼 준비를 합니다'],
      flight: ['행운을 날리고 있어요', '구슬이 도착하면 놀이판이 펼쳐집니다'],
      running: ['행운이 굴러가는 중', '마지막 구슬까지 천천히 지켜봐 주세요']
    };
    var copy = this.locked ? (stages[this.scene] || stages.mixing) : ['게임 시작', '구슬을 섞고, 오늘의 행운을 날려요'];
    $('start-button').querySelector('span:nth-child(2)').firstChild.textContent = copy[0];
    $('start-button').querySelector('small').textContent = copy[1];
  };
  UI.prototype.setLocked = function (value) {
    this.locked = !!value;
    document.querySelectorAll('[data-physical], [data-rule], [data-map], #names, #rank-n, #shuffle-button').forEach(function (control) { control.disabled = !!value; });
    $('start-button').disabled = !!value;
    this.updateStartCopy();
    if (value && this.isGameScene() && global.innerWidth <= 850 && this.panelOpen) { this.panelOpen = false; this.updatePanel(); }
  };
  UI.prototype.setStatus = function (status) {
    this.status = status;
    var copy = { intro: '작은 행운을 기다리는 중', setup: '오늘의 놀이를 준비해 주세요', idle: '추첨을 준비하고 있어요', ready: '추첨을 준비하고 있어요', mixing: '구슬을 고르게 섞고 있어요', aiming: '대포를 출발선으로 돌리고 있어요', flight: '행운을 날리고 있어요', running: '행운이 천천히 굴러오는 중', finished: '오늘의 행운이 도착했습니다' };
    $('game-status').textContent = copy[status] || String(status).toUpperCase();
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
      if (!controls.length) { event.preventDefault(); $('scene-status').focus({ preventScroll: true }); return; }
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
    $('scene-status').setAttribute('aria-hidden', String(['mixing','aiming','flight'].indexOf(this.scene) < 0));
  };
  UI.prototype.setScene = function (stage) {
    var states = ['intro','setup','mixing','aiming','flight','running','finished'];
    if (states.indexOf(stage) < 0) stage = 'intro';
    var previous = this.scene, self = this;
    this.scene = stage; document.body.dataset.scene = stage;
    if (!this.isGameScene()) this.focusMode = stage !== 'intro' && stage !== 'setup';
    else if (previous !== 'running' && previous !== 'finished') this.focusMode = true;
    document.body.classList.toggle('focus-mode', this.focusMode);
    states.forEach(function (name) { document.body.classList.toggle('scene-' + name, stage === name); });
    document.body.classList.remove('intro-active','launch-active');
    if (!this.isGameScene()) this.panelOpen = stage === 'setup';
    else if (previous !== 'running' && previous !== 'finished') this.panelOpen = false;
    this.updatePanel(); this.syncSceneAccess(); this.setStatus(stage);
    this.setSceneProgress({ reveal: this.isGameScene() ? 1 : 0 });
    var captions = { mixing: '유리 대포 속에서 구슬을 고르게 섞고 있어요.', aiming: '출발선을 향해 대포를 돌립니다.', flight: '오늘의 작은 행운이 날아갑니다.' };
    $('scene-status').textContent = captions[stage] || '';
    if (!this.isGameScene()) { this.hideResults(); this.hideCountdown(); }
    if (stage === 'intro' && previous !== stage) $('intro-start-button').focus({ preventScroll: true });
    else if (stage === 'setup' && previous !== stage) {
      requestAnimationFrame(function () { if (self.scene !== 'setup') return; var next = !$('names').disabled ? $('names') : self.getSetupControls()[0]; if (next) next.focus({ preventScroll: true }); });
    } else if (['mixing','aiming','flight'].indexOf(stage) >= 0 && previous !== stage) $('scene-status').focus({ preventScroll: true });
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
    var heading = $('stage-heading').getBoundingClientRect();
    var panel = $('setup-panel').getBoundingClientRect();
    var hints = document.querySelector('.camera-hints').getBoundingClientRect();
    var footer = document.querySelector('.system-footer').getBoundingClientRect();
    var top = Math.max(document.querySelector('.masthead').getBoundingClientRect().bottom + 20, heading.bottom + 16);
    var bottom = Math.min(height - 35, hints.top > 0 ? hints.top - 18 : footer.top - 26);
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
    return { x: left, y: top, w: Math.max(160, right - left), h: Math.max(200, bottom - top) };
  };
  UI.prototype.colorFor = function (marble, total) {
    if (marble.color) return marble.color;
    if (P.marbleColor && P.THEMES && P.THEMES[this.theme]) return P.marbleColor(marble.colorIndex || 0, Math.max(1, total || this.totalCount), P.THEMES[this.theme]);
    return 'hsl(' + ((marble.colorIndex || 0) * 57 + 250) + ',75%,70%)';
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
      $('elapsed').replaceChildren(document.createTextNode(formatTime(data.time, false)));
      var small = document.createElement('small'); small.textContent = '.' + String(Math.floor((Math.max(0, data.time) % 1) * 100)).padStart(2, '0'); $('elapsed').appendChild(small);
    }
    if (data.fps !== undefined) $('fps').textContent = Math.round(data.fps);
    if (data.seed !== undefined) { $('hud-seed').textContent = data.seed || '매번 새 출발'; $('hud-seed').title = data.seed || '발사할 때마다 새로운 시드로 출발합니다'; }
    if (Array.isArray(data.ranking)) this.renderRanking(data.ranking.slice(0, 5));
  };
  UI.prototype.writeRemaining = function (count) {
    var total = document.createElement('span'); total.textContent = ' / ' + this.totalCount;
    $('remaining').replaceChildren(document.createTextNode(String(count)), total);
  };
  UI.prototype.renderRanking = function (ranking) {
    var list = $('live-ranking'), self = this;
    if (!ranking.length) { this.rankingNodes.clear(); list.replaceChildren(); return; }
    var oldPositions = new Map();
    this.rankingNodes.forEach(function (node, id) { oldPositions.set(id, node.getBoundingClientRect().top); });
    if (list.querySelector('.ranking-empty')) list.replaceChildren();
    var present = new Set();
    ranking.forEach(function (marble, index) {
      var id = marble.id === undefined ? marble.name + '-' + (marble.colorIndex || index) : String(marble.id);
      present.add(id);
      var row = self.rankingNodes.get(id);
      if (!row) {
        row = document.createElement('li'); row.className = 'ranking-item';
        ['rank-number', 'rank-marble', 'rank-name', 'rank-finish'].forEach(function (cls) { var span = document.createElement('span'); span.className = cls; row.appendChild(span); });
        self.rankingNodes.set(id, row);
      }
      row.children[0].textContent = String(index + 1).padStart(2, '0');
      row.children[1].style.setProperty('--marble-color', self.colorFor(marble));
      row.children[2].textContent = marble.name;
      row.children[2].title = marble.name + (marble.copies > 1 ? ' · ' + marble.copy + '/' + marble.copies : '');
      row.children[3].replaceChildren();
      if (marble.finished) row.children[3].appendChild(icon('check'));
      list.appendChild(row);
    });
    this.rankingNodes.forEach(function (node, id) { if (!present.has(id)) { node.remove(); self.rankingNodes.delete(id); } });
    if (!document.documentElement.classList.contains('reduced-motion')) {
      this.rankingNodes.forEach(function (node, id) {
        if (!oldPositions.has(id)) return;
        var delta = oldPositions.get(id) - node.getBoundingClientRect().top;
        if (Math.abs(delta) > 1 && node.animate) node.animate([{ transform: 'translateY(' + delta + 'px)' }, { transform: 'translateY(0)' }], { duration: 350, easing: 'cubic-bezier(.2,.8,.2,1)' });
      });
    }
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
    $('winner-heading').textContent = winners.length > 3 ? winners.length + '개의 행운' : (winners.length ? winners.map(function (winner) { return winner.name; }).join(' · ') : '행운의 주인공');
    $('winner-heading').classList.remove('winner-reveal'); void $('winner-heading').offsetWidth; $('winner-heading').classList.add('winner-reveal');
    $('result-rule').textContent = (data.ruleLabel || '1등 당첨') + ' · 오늘의 행운이 도착했습니다';
    $('winner-subtitle').textContent = winners.length > 1 ? winners.length + '개의 구슬에 오늘의 행운이 도착했습니다.' : '조개와 햇살 사이로, 오늘의 행운이 굴러왔습니다.';
    $('result-seed').textContent = data.seed || '—'; $('result-seed').title = data.seed || '';
    $('result-time').textContent = formatTime(data.time, true);
    $('result-total').textContent = (data.ranking || []).length + '개 구슬';
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

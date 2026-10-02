(function (global) {
  'use strict';
  var P = global.CosmicPinball = global.CosmicPinball || {};
  var STEP = 1 / 120;
  var clamp = function (value, low, high) { return Math.max(low, Math.min(high, value)); };

  P.PHYSICS_STEP = STEP;
  P.PHYSICS_TUNING = { gravity: 620, fallSoftThreshold: 540, fallDrag: 5, fallMax: 700, velocityMax: 1050 };
  P.seedRandom = function (seed) {
    var hash = 2166136261;
    var input = String(seed);
    for (var i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return function () {
      hash += 0x6D2B79F5;
      var value = Math.imul(hash ^ (hash >>> 15), 1 | hash);
      value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  };

  P.parseNames = function (text) {
    var input = String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim();
    if (!input) throw new Error('참가자 이름을 한 명 이상 입력해 주세요.');
    var tokens = input.split(/[,\n]/);
    var seen = new Set();
    var names = [];
    tokens.forEach(function (token) {
      var value = token.trim();
      if (!value) throw new Error('빈 이름이 있어요. 연속된 쉼표나 빈 줄을 확인해 주세요.');
      var name = value;
      var count = 1;
      var star = value.lastIndexOf('*');
      if (star >= 0) {
        name = value.slice(0, star).trim();
        var copies = value.slice(star + 1).trim();
        if (!/^[1-9]\d*$/.test(copies) || name.indexOf('*') >= 0) {
          throw new Error('구슬 개수는 이름*2처럼 1 이상의 정수로 입력해 주세요.');
        }
        count = Number(copies);
      }
      if (!name) throw new Error('구슬 개수 앞에 참가자 이름을 입력해 주세요.');
      if (name.length > 40) throw new Error('참가자 이름은 40자 이내로 입력해 주세요.');
      if (/[\u0000-\u001f\u007f<>]/.test(name)) throw new Error('이름에는 제어 문자나 꺾쇠 괄호를 사용할 수 없어요.');
      if (seen.has(name)) throw new Error('“' + name + '” 이름이 중복돼요. 같은 이름은 ' + name + '*2처럼 입력해 주세요.');
      seen.add(name);
      if (!Number.isSafeInteger(count) || names.length + count > 500) throw new Error('구슬은 최대 500개까지 만들 수 있어요.');
      for (var copy = 1; copy <= count; copy++) {
        names.push({ id: 'marble-' + (names.length + 1), name: name, copy: copy, copies: count });
      }
    });
    return names;
  };

  function Physics(options) {
    options = options || {};
    if (!options.names || !options.names.length || options.names.length > 500) throw new Error('참가자는 1~500개의 구슬로 설정해 주세요.');
    this.map = options.map || P.MAPS.classic;
    this.seed = String(options.seed == null ? 'cosmic' : options.seed);
    this.random = P.seedRandom(this.seed);
    this.radius = clamp(Number(options.radius) || 12, 7, 18);
    this.gravity = clamp(Number(options.gravity) || P.PHYSICS_TUNING.gravity, 300, 1800);
    this.restitution = clamp(Number(options.restitution) || 0.72, 0.3, 0.95);
    this.skills = !!options.skills;
    this.time = 0;
    this.ticks = 0;
    this.finished = [];
    this.events = [];
    this.complete = false;
    this.marbles = [];
    var spawn = this.map.spawn;
    // A staggered packing fits even 500 large marbles above the first obstacle.
    var spacing = this.radius * 2 + 1.5;
    var columns = Math.floor((spawn.width - this.radius * 2 - spacing / 2) / spacing) + 1;
    var positions = [];
    var usedColumns = Math.min(columns, options.names.length);
    for (var index = 0; index < options.names.length; index++) {
      var column = index % usedColumns;
      var row = Math.floor(index / usedColumns);
      positions.push({
        x: spawn.x + spawn.width / 2 + (column - (usedColumns - 1) / 2) * spacing + (row % 2 ? 1 : -1) * spacing / 4,
        y: spawn.y + this.radius + row * spacing * Math.sqrt(3) / 2
      });
    }
    for (var shuffle = positions.length - 1; shuffle > 0; shuffle--) {
      var other = Math.floor(this.random() * (shuffle + 1));
      var temp = positions[shuffle]; positions[shuffle] = positions[other]; positions[other] = temp;
    }
    for (var n = 0; n < options.names.length; n++) {
      var entry = options.names[n];
      var position = positions[n];
      this.marbles.push({
        id: entry.id, name: entry.name, copy: entry.copy || 1, copies: entry.copies || 1,
        x: position.x + (this.random() - 0.5) * 1.5, y: position.y,
        vx: (this.random() - 0.5) * 60, vy: 0, r: this.radius, baseRadius: this.radius,
        angle: this.random() * Math.PI * 2, finished: false, finishTime: null,
        colorIndex: n, trail: [], skill: null,
        _anchorY: position.y, _stuckAt: 0, _nextSkill: 4 + this.random() * 8,
        _contacts: Object.create(null), _portalAt: -2, _boostAt: -2
      });
    }
    this._staticGrid = new Map();
    this._dynamic = [];
    this._dynamicPoses = [];
    this._dynamicGrid = new Map();
    this._fields = [];
    this._indexObstacles();
  }

  Physics.prototype._event = function (type, marble, obstacle, intensity, extra) {
    if (this.events.length > 300) return;
    var event = { type: type, x: marble.x, y: marble.y, marble: marble, id: marble.id, obstacle: obstacle || null, intensity: intensity || 1 };
    if (extra) Object.assign(event, extra);
    this.events.push(event);
  };

  Physics.prototype._indexObstacles = function () {
    var self = this;
    (this.map.obstacles || []).forEach(function (obstacle, index) {
      if (!obstacle.id) obstacle.id = 'obstacle-' + index;
      if (obstacle.type === 'rotor' || obstacle.type === 'moving') { self._dynamic.push(obstacle); return; }
      if (obstacle.type === 'boost' || obstacle.type === 'portal') { self._fields.push(obstacle); return; }
      var bounds = self._bounds(obstacle);
      for (var gx = Math.floor(bounds.minX / 96); gx <= Math.floor(bounds.maxX / 96); gx++) {
        for (var gy = Math.floor(bounds.minY / 96); gy <= Math.floor(bounds.maxY / 96); gy++) {
          var key = gx + ':' + gy;
          if (!self._staticGrid.has(key)) self._staticGrid.set(key, []);
          self._staticGrid.get(key).push(obstacle);
        }
      }
    });
  };

  Physics.prototype._bounds = function (obstacle) {
    if (obstacle.type === 'polygon') {
      var xs = obstacle.points.map(function (p) { return p.x; });
      var ys = obstacle.points.map(function (p) { return p.y; });
      return { minX: Math.min.apply(null, xs) - 24, minY: Math.min.apply(null, ys) - 24, maxX: Math.max.apply(null, xs) + 24, maxY: Math.max.apply(null, ys) + 24 };
    }
    if (obstacle.type === 'segment') {
      var padding = (obstacle.thickness || 6) + 24;
      return { minX: Math.min(obstacle.x1, obstacle.x2) - padding, minY: Math.min(obstacle.y1, obstacle.y2) - padding, maxX: Math.max(obstacle.x1, obstacle.x2) + padding, maxY: Math.max(obstacle.y1, obstacle.y2) + padding };
    }
    var radius = (obstacle.r || 8) + 24;
    return { minX: obstacle.x - radius, minY: obstacle.y - radius, maxX: obstacle.x + radius, maxY: obstacle.y + radius };
  };

  Physics.prototype.getObstaclePose = function (obstacle) {
    if (obstacle.type === 'segment') return obstacle;
    if (obstacle.type !== 'rotor' && obstacle.type !== 'moving') return obstacle;
    var x = obstacle.x, y = obstacle.y;
    var angle = obstacle.angle || 0;
    var speed = obstacle.speed || 1;
    var vx = 0, vy = 0;
    if (obstacle.type === 'rotor') angle += this.time * speed;
    else {
      var phase = this.time * speed + (obstacle.phase || 0);
      var offset = Math.sin(phase) * (obstacle.amplitude || 90);
      var velocity = Math.cos(phase) * (obstacle.amplitude || 90) * speed;
      if (obstacle.axis === 'y') { y += offset; vy = velocity; }
      else { x += offset; vx = velocity; }
    }
    var dx = Math.cos(angle) * obstacle.length / 2;
    var dy = Math.sin(angle) * obstacle.length / 2;
    return { x: x, y: y, angle: angle, x1: x - dx, y1: y - dy, x2: x + dx, y2: y + dy, thickness: obstacle.thickness || 7, vx: vx, vy: vy };
  };

  Physics.prototype._reflect = function (marble, nx, ny, penetration, obstacle, surfaceVx, surfaceVy) {
    marble.x += nx * (penetration + 0.015);
    marble.y += ny * (penetration + 0.015);
    var rvx = marble.vx - (surfaceVx || 0);
    var rvy = marble.vy - (surfaceVy || 0);
    var normalVelocity = rvx * nx + rvy * ny;
    if (normalVelocity >= 0) return;
    var bounce = obstacle && obstacle.type === 'bumper' ? 1.08 : this.restitution;
    var impulse = -(1 + bounce) * normalVelocity;
    if (obstacle && obstacle.type === 'bumper') impulse += obstacle.power || 90;
    marble.vx += impulse * nx;
    marble.vy += impulse * ny;
    if (obstacle && -normalVelocity > 40 && this.time - (marble._contacts[obstacle.id] || -1) > 0.085) {
      marble._contacts[obstacle.id] = this.time;
      this._event(obstacle.type === 'bumper' ? 'bumper' : 'hit', marble, obstacle, clamp(-normalVelocity / 450, 0.15, 1.8));
    }
  };

  Physics.prototype._circle = function (marble, obstacle) {
    var dx = marble.x - obstacle.x, dy = marble.y - obstacle.y;
    var sum = marble.r + obstacle.r;
    var distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= sum * sum) return;
    var distance = Math.sqrt(distanceSquared);
    if (distance < 0.00001) { dx = 0; dy = -1; distance = 1; }
    this._reflect(marble, dx / distance, dy / distance, sum - distance, obstacle, 0, 0);
  };

  Physics.prototype._segment = function (marble, pose, obstacle) {
    var sx = pose.x2 - pose.x1, sy = pose.y2 - pose.y1;
    var lengthSquared = sx * sx + sy * sy;
    var t = lengthSquared ? clamp(((marble.x - pose.x1) * sx + (marble.y - pose.y1) * sy) / lengthSquared, 0, 1) : 0;
    var closestX = pose.x1 + sx * t, closestY = pose.y1 + sy * t;
    var dx = marble.x - closestX, dy = marble.y - closestY;
    var radius = marble.r + (pose.thickness || 6);
    var distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= radius * radius) return;
    var distance = Math.sqrt(distanceSquared);
    if (distance < 0.00001) {
      distance = 1; dx = sy; dy = -sx;
      var normalLength = Math.hypot(dx, dy) || 1;
      dx /= normalLength; dy /= normalLength;
    }
    var surfaceVx = pose.vx || 0, surfaceVy = pose.vy || 0;
    if (obstacle.type === 'rotor') {
      surfaceVx = -(closestY - obstacle.y) * obstacle.speed;
      surfaceVy = (closestX - obstacle.x) * obstacle.speed;
    }
    this._reflect(marble, dx / distance, dy / distance, radius - distance, obstacle, surfaceVx, surfaceVy);
  };

  Physics.prototype._polygon = function (marble, obstacle) {
    var points = obstacle.points;
    var inside = false;
    var nearest = null;
    for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
      var a = points[j], b = points[i];
      if ((a.y > marble.y) !== (b.y > marble.y) && marble.x < (b.x - a.x) * (marble.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
      var sx = b.x - a.x, sy = b.y - a.y;
      var t = clamp(((marble.x - a.x) * sx + (marble.y - a.y) * sy) / (sx * sx + sy * sy), 0, 1);
      var x = a.x + sx * t, y = a.y + sy * t;
      var d2 = (marble.x - x) * (marble.x - x) + (marble.y - y) * (marble.y - y);
      if (!nearest || d2 < nearest.d2) nearest = { x: x, y: y, d2: d2, a: a, b: b };
    }
    if (inside) {
      var distance = Math.sqrt(nearest.d2) || 0.0001;
      var nx = (nearest.x - marble.x) / distance, ny = (nearest.y - marble.y) / distance;
      this._reflect(marble, nx, ny, distance + marble.r + 0.5, obstacle, 0, 0);
    } else {
      for (var edge = 0; edge < points.length; edge++) {
        var start = points[edge], end = points[(edge + 1) % points.length];
        this._segment(marble, { x1: start.x, y1: start.y, x2: end.x, y2: end.y, thickness: 0.5 }, obstacle);
      }
    }
  };

  Physics.prototype._obstacles = function (marble) {
    var candidates = this._staticGrid.get(Math.floor(marble.x / 96) + ':' + Math.floor(marble.y / 96)) || [];
    for (var i = 0; i < candidates.length; i++) {
      var obstacle = candidates[i];
      if (obstacle.type === 'pin' || obstacle.type === 'bumper' || obstacle.type === 'circle') this._circle(marble, obstacle);
      else if (obstacle.type === 'segment') this._segment(marble, obstacle, obstacle);
      else if (obstacle.type === 'polygon') this._polygon(marble, obstacle);
    }
    var dynamicCandidates = this._dynamicGrid.get(Math.floor(marble.x / 96) + ':' + Math.floor(marble.y / 96)) || [];
    for (var dynamic = 0; dynamic < dynamicCandidates.length; dynamic++) {
      var moving = dynamicCandidates[dynamic];
      this._segment(marble, moving.pose, moving.obstacle);
    }
  };

  Physics.prototype._walls = function (marble) {
    if (marble.x < marble.r) { marble.x = marble.r; marble.vx = Math.abs(marble.vx) * this.restitution; }
    if (marble.x > this.map.width - marble.r) { marble.x = this.map.width - marble.r; marble.vx = -Math.abs(marble.vx) * this.restitution; }
    if (marble.y < marble.r) { marble.y = marble.r; marble.vy = Math.abs(marble.vy) * this.restitution; }
  };

  Physics.prototype._pairs = function () {
    var grid = new Map();
    var size = 48;
    var active = this.marbles;
    for (var i = 0; i < active.length; i++) {
      var marble = active[i];
      if (marble.finished) continue;
      var gx = Math.floor(marble.x / size), gy = Math.floor(marble.y / size);
      for (var xx = gx - 1; xx <= gx + 1; xx++) {
        for (var yy = gy - 1; yy <= gy + 1; yy++) {
          var bucket = grid.get(xx + ':' + yy);
          if (!bucket) continue;
          for (var b = 0; b < bucket.length; b++) {
            var other = bucket[b];
            var dx = marble.x - other.x, dy = marble.y - other.y;
            var radius = marble.r + other.r;
            var d2 = dx * dx + dy * dy;
            if (d2 >= radius * radius) continue;
            var distance = Math.sqrt(d2);
            if (distance < 0.00001) { dx = 1; dy = 0; distance = 1; }
            var nx = dx / distance, ny = dy / distance;
            var correction = (radius - distance + 0.01) * 0.5;
            marble.x += nx * correction; marble.y += ny * correction;
            other.x -= nx * correction; other.y -= ny * correction;
            var rv = (marble.vx - other.vx) * nx + (marble.vy - other.vy) * ny;
            if (rv < 0) {
              var impulse = -(1 + this.restitution) * rv * 0.5;
              marble.vx += impulse * nx; marble.vy += impulse * ny;
              other.vx -= impulse * nx; other.vy -= impulse * ny;
            }
          }
        }
      }
      var key = gx + ':' + gy;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(marble);
    }
  };

  Physics.prototype._fieldsStep = function (marble) {
    for (var i = 0; i < this._fields.length; i++) {
      var field = this._fields[i];
      if (field.type === 'boost') {
        if (Math.abs(marble.x - field.x) > field.width / 2 || Math.abs(marble.y - field.y) > field.height / 2) continue;
        marble.vx += (field.dx || 0) * field.power * STEP;
        marble.vy += (field.dy == null ? 1 : field.dy) * field.power * STEP;
        if (this.time - marble._boostAt > 0.45) {
          marble._boostAt = this.time;
          this._event('boost', marble, field, 0.9);
        }
      } else if (field.type === 'portal' && !field.exit && this.time - marble._portalAt > 0.85) {
        var dx = marble.x - field.x, dy = marble.y - field.y;
        if (dx * dx + dy * dy > (field.r - marble.r * 0.25) * (field.r - marble.r * 0.25)) continue;
        this._event('portal', marble, field, 1, { targetX: field.targetX, targetY: field.targetY });
        marble.x = field.targetX;
        marble.y = field.targetY;
        marble.vx = field.exitVx == null ? marble.vx : field.exitVx;
        marble.vy = field.exitVy == null ? Math.max(120, marble.vy) : field.exitVy;
        marble._portalAt = this.time;
        marble._anchorY = marble.y;
        marble._stuckAt = this.time;
        marble.trail.length = 0;
      }
    }
  };

  Physics.prototype._skillsStep = function (marble) {
    if (marble.skill && this.time >= marble.skill.until) { marble.skill = null; marble.r = marble.baseRadius; }
    if (!this.skills || this.time < marble._nextSkill) return;
    marble._nextSkill = this.time + 5 + this.random() * 7;
    if (this.random() > 0.3) return;
    var kind = ['haste', 'pulse', 'grow'][Math.floor(this.random() * 3)];
    marble.skill = { kind: kind, until: this.time + 1.2 };
    if (kind === 'haste') marble.vy += 135;
    else if (kind === 'grow') marble.r = marble.baseRadius * 1.22;
    else {
      for (var i = 0; i < this.marbles.length; i++) {
        var other = this.marbles[i];
        if (other === marble || other.finished) continue;
        var dx = other.x - marble.x, dy = other.y - marble.y;
        var distance = Math.hypot(dx, dy);
        if (distance > 0 && distance < 110) {
          var force = (1 - distance / 110) * 145;
          other.vx += dx / distance * force; other.vy += dy / distance * force;
        }
      }
    }
    this._event('skill', marble, null, 1, { skill: kind });
  };

  Physics.prototype.step = function () {
    if (this.complete) return;
    this.ticks++;
    this.time = this.ticks * STEP;
    // All marbles see the same pose; avoid repeated trigonometry in the solver.
    this._dynamicGrid.clear();
    for (var poseIndex = 0; poseIndex < this._dynamic.length; poseIndex++) {
      var dynamicObstacle = this._dynamic[poseIndex];
      var dynamicPose = this.getObstaclePose(dynamicObstacle);
      this._dynamicPoses[poseIndex] = dynamicPose;
      var dynamicEntry = { obstacle: dynamicObstacle, pose: dynamicPose };
      var pad = dynamicPose.thickness + 24;
      var minGX = Math.floor((Math.min(dynamicPose.x1, dynamicPose.x2) - pad) / 96);
      var maxGX = Math.floor((Math.max(dynamicPose.x1, dynamicPose.x2) + pad) / 96);
      var minGY = Math.floor((Math.min(dynamicPose.y1, dynamicPose.y2) - pad) / 96);
      var maxGY = Math.floor((Math.max(dynamicPose.y1, dynamicPose.y2) + pad) / 96);
      for (var gridX = minGX; gridX <= maxGX; gridX++) {
        for (var gridY = minGY; gridY <= maxGY; gridY++) {
          var gridKey = gridX + ':' + gridY;
          if (!this._dynamicGrid.has(gridKey)) this._dynamicGrid.set(gridKey, []);
          this._dynamicGrid.get(gridKey).push(dynamicEntry);
        }
      }
    }
    var crossings = [];
    for (var i = 0; i < this.marbles.length; i++) {
      var marble = this.marbles[i];
      if (marble.finished) continue;
      marble._previousY = marble.y;
      this._skillsStep(marble);
      marble.vy += this.gravity * STEP;
      if (marble.vy > P.PHYSICS_TUNING.fallSoftThreshold) {
        marble.vy -= (marble.vy - P.PHYSICS_TUNING.fallSoftThreshold) * P.PHYSICS_TUNING.fallDrag * STEP;
      }
      marble.vy = Math.min(marble.vy, P.PHYSICS_TUNING.fallMax);
      marble.vx *= 0.9998;
      var speed = Math.hypot(marble.vx, marble.vy);
      if (speed > P.PHYSICS_TUNING.velocityMax) { marble.vx *= P.PHYSICS_TUNING.velocityMax / speed; marble.vy *= P.PHYSICS_TUNING.velocityMax / speed; }
      marble.x += marble.vx * STEP;
      marble.y += marble.vy * STEP;
      marble.angle += marble.vx / marble.r * STEP;
      this._fieldsStep(marble);
      this._walls(marble);
      this._obstacles(marble);
    }
    for (var pass = 0; pass < 2; pass++) {
      this._pairs();
      for (var solve = 0; solve < this.marbles.length; solve++) {
        var item = this.marbles[solve];
        if (!item.finished) { this._obstacles(item); this._walls(item); }
      }
    }
    for (var n = 0; n < this.marbles.length; n++) {
      var ball = this.marbles[n];
      if (ball.finished) continue;
      if (ball.y > ball._anchorY + 24) { ball._anchorY = ball.y; ball._stuckAt = this.time; }
      if (this.time - ball._stuckAt >= 2.65) {
        ball.vx += (this.random() < 0.5 ? -1 : 1) * (210 + this.random() * 125);
        ball.vy += 120 + this.random() * 70;
        ball._stuckAt = this.time;
        ball._anchorY = ball.y;
        this._event('boost', ball, null, 0.55, { rescue: true });
      }
      if (ball.y >= this.map.finish.y) {
        var crossed = clamp((this.map.finish.y - ball._previousY) / (ball.y - ball._previousY || 1), 0, 1);
        ball.finishTime = (this.ticks - 1 + crossed) * STEP;
        crossings.push(ball);
      }
      if (this.ticks % 3 === 0) {
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 14) ball.trail.shift();
      }
    }
    crossings.sort(function (a, b) { return a.finishTime - b.finishTime || a.colorIndex - b.colorIndex; });
    for (var finish = 0; finish < crossings.length; finish++) {
      var winner = crossings[finish];
      winner.finished = true;
      winner.r = winner.baseRadius;
      winner.y = this.map.finish.y;
      winner.x = clamp(winner.x, winner.r, this.map.width - winner.r);
      winner.vx = 0; winner.vy = 0;
      this.finished.push(winner);
      this._event('finish', winner, null, 1, { rank: this.finished.length });
    }
    this.complete = this.finished.length === this.marbles.length;
  };

  Physics.prototype.drainEvents = function () { var events = this.events; this.events = []; return events; };
  Physics.prototype.getRanking = function () {
    var active = this.marbles.filter(function (marble) { return !marble.finished; });
    active.sort(function (a, b) { return b.y - a.y || a.colorIndex - b.colorIndex; });
    return this.finished.concat(active);
  };
  P.Physics = Physics;
})(window);

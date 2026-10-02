(function (global) {
  'use strict';
  var P = global.CosmicPinball = global.CosmicPinball || {};
  P.MAPS = {
    classic: {
      id: 'classic', name: '자개 핀 보드', subtitle: 'CLASSIC PEARL BOARD',
      width: 1000, height: 7160,
      spawn: { x: 12, y: 50, width: 976, height: 680 },
      finish: { y: 6960 }, obstacles: []
    },
    dynamic: {
      id: 'dynamic', name: '금박 회전길', subtitle: 'GOLDEN SPIN COURSE',
      width: 1000, height: 7160,
      spawn: { x: 12, y: 50, width: 976, height: 680 },
      finish: { y: 6960 }, obstacles: []
    },
    hybrid: {
      id: 'hybrid', name: '행운 갈림길', subtitle: 'LUCKY BOOST & GATE',
      width: 1000, height: 7160,
      spawn: { x: 12, y: 50, width: 976, height: 680 },
      finish: { y: 6960 }, obstacles: []
    }
  };

  // Maps are ordinary data: renderer, collision solver and minimap share these shapes.
  var classic = P.MAPS.classic.obstacles;
  for (var row = 0; row < 10; row++) {
    for (var col = 0; col < 9; col++) {
      var x = 80 + col * 105 + (row % 2 ? 48 : 0);
      if (x > 950) continue;
      classic.push({ type: 'pin', id: 'star-pin-' + row + '-' + col, x: x, y: 790 + row * 218, r: row % 3 === 0 ? 11 : 9 });
    }
  }
  [
    { x: 290, y: 1120 }, { x: 710, y: 1340 }, { x: 500, y: 1560 },
    { x: 245, y: 1990 }, { x: 755, y: 2210 }, { x: 500, y: 2650 }
  ].forEach(function (point, index) {
    classic.push({ type: 'bumper', id: 'star-bumper-' + index, x: point.x, y: point.y, r: 38, power: 110 });
  });
  classic.push(
    { type: 'segment', id: 'star-ramp-l', x1: 0, y1: 1790, x2: 150, y2: 1880, thickness: 7 },
    { type: 'segment', id: 'star-ramp-r', x1: 1000, y1: 2410, x2: 850, y2: 2500, thickness: 7 }
  );

  var dynamic = P.MAPS.dynamic.obstacles;
  [
    { x: 270, y: 860, length: 240, speed: 1.2, angle: 0.3 },
    { x: 730, y: 910, length: 240, speed: -1.15, angle: -0.3 },
    { x: 500, y: 1250, length: 320, speed: 1.1, angle: 0.9 },
    { x: 250, y: 1630, length: 230, speed: -1.65, angle: 0.5 },
    { x: 750, y: 1660, length: 230, speed: 1.65, angle: -0.5 },
    { x: 500, y: 2060, length: 320, speed: -1.3, angle: 0.6 },
    { x: 270, y: 2520, length: 220, speed: 1.7, angle: 0.4 },
    { x: 730, y: 2540, length: 220, speed: -1.7, angle: -0.4 }
  ].forEach(function (rotor, index) {
    dynamic.push(Object.assign({ type: 'rotor', id: 'orbit-rotor-' + index, thickness: 9 }, rotor));
  });
  dynamic.push(
    { type: 'moving', id: 'orbit-shuttle-1', x: 270, y: 1410, length: 210, angle: 0.25, axis: 'x', amplitude: 100, speed: 1.5, phase: 0, thickness: 8 },
    { type: 'moving', id: 'orbit-shuttle-2', x: 730, y: 1450, length: 210, angle: -0.25, axis: 'x', amplitude: 100, speed: 1.5, phase: Math.PI, thickness: 8 },
    { type: 'moving', id: 'orbit-shuttle-3', x: 500, y: 2310, length: 230, angle: 0.18, axis: 'x', amplitude: 240, speed: 1.2, phase: 0.5, thickness: 8 },
    { type: 'polygon', id: 'orbit-diamond', points: [{ x: 500, y: 1740 }, { x: 575, y: 1850 }, { x: 500, y: 1960 }, { x: 425, y: 1850 }] },
    { type: 'segment', id: 'orbit-guide-left', x1: 0, y1: 1060, x2: 155, y2: 1160, thickness: 8 },
    { type: 'segment', id: 'orbit-guide-right', x1: 1000, y1: 1120, x2: 845, y2: 1220, thickness: 8 }
  );
  [
    { x: 500, y: 840 }, { x: 115, y: 1920 }, { x: 885, y: 1980 },
    { x: 500, y: 2760 }
  ].forEach(function (point, index) {
    dynamic.push({ type: 'bumper', id: 'orbit-bumper-' + index, x: point.x, y: point.y, r: 34, power: 85 });
  });
  for (var layer = 0; layer < 5; layer++) {
    for (var slot = 0; slot < 4; slot++) {
      dynamic.push({ type: 'pin', id: 'orbit-pin-' + layer + '-' + slot, x: 100 + slot * 265, y: 1290 + layer * 400, r: 9 });
    }
  }

  var hybrid = P.MAPS.hybrid.obstacles;
  hybrid.push(
    { type: 'segment', id: 'worm-funnel-l', x1: 0, y1: 820, x2: 360, y2: 1040, thickness: 8 },
    { type: 'segment', id: 'worm-funnel-r', x1: 1000, y1: 820, x2: 640, y2: 1040, thickness: 8 },
    { type: 'polygon', id: 'worm-wedge-l', points: [{ x: 0, y: 1430 }, { x: 345, y: 1650 }, { x: 0, y: 1690 }] },
    { type: 'polygon', id: 'worm-wedge-r', points: [{ x: 1000, y: 1430 }, { x: 655, y: 1650 }, { x: 1000, y: 1690 }] },
    { type: 'segment', id: 'worm-funnel2-l', x1: 0, y1: 2290, x2: 360, y2: 2450, thickness: 8 },
    { type: 'segment', id: 'worm-funnel2-r', x1: 1000, y1: 2290, x2: 640, y2: 2450, thickness: 8 },
    { type: 'boost', id: 'worm-boost-1', x: 500, y: 1100, width: 190, height: 88, dx: 0.35, dy: 1, power: 2100 },
    { type: 'boost', id: 'worm-boost-2', x: 250, y: 2030, width: 180, height: 100, dx: 0.8, dy: 1, power: 1700 },
    { type: 'boost', id: 'worm-boost-3', x: 750, y: 2070, width: 180, height: 100, dx: -0.8, dy: 1, power: 1700 },
    { type: 'boost', id: 'worm-boost-4', x: 500, y: 2520, width: 190, height: 100, dx: 0, dy: 1, power: 2300 },
    { type: 'portal', id: 'worm-portal-a', x: 390, y: 1260, r: 39, targetX: 770, targetY: 1810, exitVx: -120, exitVy: 380, pair: 'a' },
    { type: 'portal', id: 'worm-portal-a-exit', x: 770, y: 1810, r: 39, exit: true, pair: 'a' },
    { type: 'portal', id: 'worm-portal-b', x: 680, y: 1330, r: 39, targetX: 230, targetY: 1830, exitVx: 120, exitVy: 380, pair: 'b' },
    { type: 'portal', id: 'worm-portal-b-exit', x: 230, y: 1830, r: 39, exit: true, pair: 'b' },
    { type: 'rotor', id: 'worm-spinner', x: 500, y: 2150, length: 230, speed: 1.45, angle: 0, thickness: 8 }
  );
  [
    { x: 500, y: 1370, r: 35 }, { x: 500, y: 1750, r: 32 },
    { x: 360, y: 1930, r: 32 }, { x: 640, y: 1930, r: 32 },
    { x: 350, y: 2740, r: 33 }, { x: 650, y: 2740, r: 33 }
  ].forEach(function (point, index) {
    hybrid.push(Object.assign({ type: 'bumper', id: 'worm-bumper-' + index, power: 90 }, point));
  });
  for (var band = 0; band < 4; band++) {
    for (var pin = 0; pin < 7; pin++) {
      hybrid.push({ type: 'pin', id: 'worm-pin-' + band + '-' + pin, x: 145 + pin * 118, y: 760 + band * 645, r: 9 });
    }
  }

  // Three inhabited sections make a longer course, including moving obstacles,
  // funnels and portals. Coordinates remain plain JSON-compatible map data.
  Object.keys(P.MAPS).forEach(function (id) {
    var map = P.MAPS[id];
    var firstSection = map.obstacles.slice();
    firstSection.forEach(function (obstacle) {
      if (obstacle.type === 'boost') obstacle.power *= 0.62;
      if (obstacle.type === 'portal' && !obstacle.exit) {
        obstacle.exitVy = 280;
        obstacle.exitVx *= 0.8;
      }
    });
    for (var section = 1; section < 3; section++) {
      firstSection.forEach(function (obstacle) {
        var copy = JSON.parse(JSON.stringify(obstacle));
        copy.id += '-section-' + (section + 1);
        var offset = section * 2000;
        ['y', 'y1', 'y2', 'targetY'].forEach(function (field) {
          if (typeof copy[field] === 'number') copy[field] += offset;
        });
        if (copy.points) copy.points.forEach(function (point) { point.y += offset; });
        if (copy.pair) copy.pair += '-section-' + (section + 1);
        if (copy.type === 'moving') copy.phase = (copy.phase || 0) + section * 0.7;
        if (copy.type === 'rotor') copy.angle += section * 0.45;
        map.obstacles.push(copy);
      });
    }
  });
})(window);

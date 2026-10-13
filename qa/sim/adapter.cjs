'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.QA_SOURCE_ROOT || path.resolve(__dirname, '../..');
function loadPhysics() {
  const window = { CosmicPinball: {} };
  for (const file of ['maps', 'map-registry', ...(['twinfold','cascade','rhythm'].filter(id => fs.existsSync(path.join(root, 'js/maps/'+id+'.js'))).map(id => 'maps/'+id)), 'physics', 'shuffle', 'hand-start']) {
    // Execute only trusted repository sources; no copied/reimplemented physics.
    new Function('window', fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'))(window);
  }
  return window.CosmicPinball;
}
function loadRules(P) {
  const source = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
  const boundary = source.indexOf("  const canvas = document.getElementById('game-canvas');");
  if (boundary < 0) throw new Error('main rule adapter boundary changed');
  new Function('window', 'localStorage', source.slice(0, boundary) + '\n})();')(
    { CosmicPinball: P }, { getItem: () => null });
  return P.chooseWinners;
}
module.exports = { loadPhysics, loadRules, root };

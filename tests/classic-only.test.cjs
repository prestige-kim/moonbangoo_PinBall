const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
test('only classic remains and its complete geometry is unchanged', () => {
  const scope = { window: {} }; vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/maps.js'), 'utf8'), scope);
  const maps = scope.window.CosmicPinball.MAPS;
  assert.deepEqual(Object.keys(maps), ['classic']);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(maps.classic)).digest('hex'),
    'a70668a382bd803cf187f690a3963f4732ed6f370f3d9ed88862fc9a0426f8cf', 'existing classical trajectories keep the exact same map');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /data-map=|id="map-label"|class="map-grid"|코스를 골라/);
});

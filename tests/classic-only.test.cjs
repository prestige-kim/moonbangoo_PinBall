const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
test('classic includes a narrowing winding chute with closed collision walls and rotors', () => {
  const scope = { window: {} }; vm.createContext(scope);
  for (const name of ['maps','physics']) vm.runInContext(fs.readFileSync(path.join(root, 'js/'+name+'.js'), 'utf8'), scope);
  const P=scope.window.CosmicPinball,maps=P.MAPS,map=maps.classic;
  assert.deepEqual(Object.keys(maps), ['classic']);
  assert.equal(map.obstacles.filter(o=>o.type==='rotor').length,14);
  const walls=map.obstacles.filter(o=>o.channelWall);assert.equal(walls.length,2);
  assert.equal(Math.min(...map.channel.map(n=>n.width)),320);
  const physics=new P.Physics({names:P.parseNames('검정'),map,seed:'channel-wall'});
  for(const node of map.channel.slice(1,-1)) {
    const bounds=P.courseBounds(map,node.y),marble={...physics.marbles[0],x:node.center,y:node.y,r:18};
    assert.equal(bounds.right-bounds.left,node.width);
    assert.equal(physics._contact(marble,walls[0],walls[0],0),null);
    assert.equal(physics._contact(marble,walls[1],walls[1],0),null);
    assert(physics._contact({...marble,x:bounds.left-25},walls[0],walls[0],0)?.depth>0,'left side cannot be bypassed');
    assert(physics._contact({...marble,x:bounds.right+25},walls[1],walls[1],0)?.depth>0,'right side cannot be bypassed');
  }
  assert.equal(P.courseBounds(map,1000).left,36);assert.equal(P.courseBounds(map,5500).right,964);
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/id="map-grid"/);
});

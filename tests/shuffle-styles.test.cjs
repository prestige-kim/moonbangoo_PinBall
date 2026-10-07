const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

test('the shuffle stylesheet uses its content revision so old noninteractive CSS cannot stay cached', () => {
  const root = path.join(__dirname, '..');
  const css = fs.readFileSync(path.join(root, 'style.css'));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const href = html.match(/<link\s+rel="stylesheet"\s+href="([^"]+)"/)[1];
  const revision = 'hand-' + crypto.createHash('sha256').update(css).digest('hex').slice(0, 12);
  assert.equal(new URL(href, 'http://localhost/').searchParams.get('v'), revision,
    'A changed stylesheet needs a new URL: the previous cached CSS leaves cinema-canvas pointer-events:none.');
});

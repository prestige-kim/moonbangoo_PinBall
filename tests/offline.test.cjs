const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

test('offline entry uses only existing relative styles and classic scripts', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<script[^>]*type\s*=\s*["']module/i);
  const resources = [...html.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
  assert.ok(resources.length >= 10);
  for (const resource of resources) {
    assert.match(resource, /^\.\//, 'file:// must resolve a relative resource: ' + resource);
    const pathname = resource.split(/[?#]/, 1)[0];
    assert.ok(fs.existsSync(path.join(root, pathname)), 'Missing local resource: ' + resource);
  }
  assert.doesNotMatch(html, /<(?:img|iframe|audio|video)[^>]*src\s*=\s*["'](?:https?:)?\/\//i);
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.doesNotMatch(css, /@import\b|url\s*\(\s*["']?(?:https?:)?\/\//i);
  for (const file of fs.readdirSync(path.join(root, 'js'))) {
    const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
    new vm.Script(source, { filename: file });
    assert.doesNotMatch(source, /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bimport\s*(?:\(|["'{*])/,
      'Offline game must not depend on runtime network/module loading: ' + file);
  }
});

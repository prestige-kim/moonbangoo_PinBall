const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function fixture({ webkit = false, state = 'running' } = {}) {
  class Param {
    constructor() { this.value = 0; this.events = []; }
    setValueAtTime(value, time) { this.record('set', value, time); }
    exponentialRampToValueAtTime(value, time) { assert(value > 0); this.record('ramp', value, time); }
    setTargetAtTime(value, time, decay) { assert(decay > 0); this.record('target', value, time); }
    record(type, value, time) { assert(Number.isFinite(value)); assert(Number.isFinite(time)); this.events.push({ type, value, time }); }
  }
  class Node {
    constructor(kind, context) {
      this.kind = kind; this.connections = []; this.disconnects = 0;
      this.frequency = new Param(); this.gain = new Param(); this.Q = new Param();
      context.nodes.push(this);
    }
    connect(node) { this.connections.push(node); }
    disconnect() { this.disconnects++; }
    start(time) { this.startTime = time; }
    stop(time) { assert(time > this.startTime); this.stopTime = time; }
  }
  class Context {
    constructor() { this.state = state; this.currentTime = 12.25; this.sampleRate = 8000; this.destination = {}; this.nodes = []; this.buffers = []; this.resumes = 0; }
    createGain() { return new Node('gain', this); }
    createOscillator() { return new Node('oscillator', this); }
    createBiquadFilter() { return new Node('filter', this); }
    createBufferSource() { return new Node('noise', this); }
    createBuffer(channels, length, sampleRate) {
      assert.equal(channels, 1); assert.equal(sampleRate, this.sampleRate);
      const data = new Float32Array(length), buffer = { getChannelData: () => data };
      this.buffers.push(buffer); return buffer;
    }
    resume() { this.resumes++; return Promise.resolve(); }
  }
  const sandbox = { window: { [webkit ? 'webkitAudioContext' : 'AudioContext']: Context },
    setTimeout() { throw new Error('Audio timing must use the context clock'); } };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/audio.js'), 'utf8'), sandbox);
  const P = sandbox.window.CosmicPinball, audio = new P.AudioEngine();
  audio.unlock();
  return { audio, context: audio.context, P };
}
function sources(context) { return context.nodes.filter(node => node.kind === 'noise' || node.kind === 'oscillator'); }
function finish(context) { for (const source of sources(context)) if (source.onended) source.onended(); }

test('cannon layers share the audio clock, have a sharp attack and bounded gain', () => {
  const { audio, context } = fixture();
  audio.configure({ sound: true, volume: 1, theme: 'gold' });
  audio.play('cannon', 1);
  const all = sources(context), body = all.find(node => node.kind === 'oscillator');
  assert.equal(all.length, 3); assert.equal(audio.voices, 3);
  assert.equal(all.filter(node => node.kind === 'noise').length, 2);
  assert.equal(body.type, 'sine');
  assert.equal(body.startTime, context.currentTime);
  assert.deepEqual(body.frequency.events.map(event => event.value), [190, 48, 34]);
  assert(all.every(node => node.startTime >= context.currentTime && node.stopTime <= context.currentTime + 0.66));
  const peaks = context.nodes.filter(node => node.kind === 'gain' && node !== audio.master)
    .map(node => Math.max(...node.gain.events.map(event => event.value)));
  assert(peaks.reduce((sum, gain) => sum + gain, 0) * 0.42 < 0.25, 'combined full-volume peaks leave headroom');
  assert(context.buffers[0].getChannelData(0).every(value => Number.isFinite(value) && value >= -1 && value <= 1));
});

test('ended cannon sources release voice slots and disconnect the complete graph', () => {
  const { audio, context } = fixture();
  audio.play('cannon', 0.8);
  finish(context);
  assert.equal(audio.voices, 0);
  assert(context.nodes.filter(node => node !== audio.master).every(node => node.disconnects === 1));
  assert.equal(audio.master.disconnects, 0);
});

test('sound settings and a suspended context prevent new cannon and charge voices', () => {
  const { audio, context } = fixture();
  audio.configure({ sound: false, volume: 0.8, theme: 'gold' });
  audio.play('cannon'); audio.play('charge');
  assert.equal(sources(context).length, 0);
  assert.equal(audio.master.gain.events.at(-1).value, 0);
  audio.configure({ sound: true, volume: 0.25, theme: 'gold' });
  assert.equal(audio.master.gain.events.at(-1).value, 0.25 * 0.42);
  context.state = 'suspended';
  audio.play('cannon'); audio.play('charge');
  assert.equal(sources(context).length, 0);
  assert.equal(context.buffers.length, 0);
});

test('the existing voice limit caps cannon layers and prioritizes its body', () => {
  const { audio, context, P } = fixture();
  for (let i = 0; i < P.SOUND_CONFIG.voices - 1; i++) audio.tone(220, 0.2, 0.04);
  audio.play('cannon', 1);
  assert.equal(audio.voices, P.SOUND_CONFIG.voices);
  assert.equal(sources(context).filter(node => node.kind === 'noise').length, 0);
  assert.equal(sources(context).at(-1).frequency.events[0].value, 190);
  const count = context.nodes.length;
  audio.play('cannon'); audio.play('charge');
  assert.equal(context.nodes.length, count);
  finish(context); assert.equal(audio.voices, 0);
});

test('quiet charging and repeated cannon shots reuse one noise buffer', () => {
  const { audio, context } = fixture();
  audio.play('charge');
  assert.equal(audio.voices, 2);
  assert.equal(sources(context)[1].startTime, context.currentTime + 0.12);
  const chargeGains = context.nodes.filter(node => node.kind === 'gain' && node !== audio.master)
    .flatMap(node => node.gain.events.map(event => event.value));
  assert(Math.max(...chargeGains) <= 0.035);
  finish(context);
  const originalBuffer = context.buffers[0];
  audio.play('cannon');
  assert.equal(context.buffers.length, 1);
  assert(sources(context).filter(node => node.kind === 'noise').every(node => node.buffer === originalBuffer));
});

test('iOS AudioContext fallback resumes and existing result melody remains available', () => {
  const { audio, context } = fixture({ webkit: true, state: 'suspended' });
  assert.equal(context.resumes, 1);
  context.state = 'running'; audio.play('finish');
  assert.equal(audio.voices, 2);
  assert(sources(context).every(node => node.kind === 'oscillator'));
});

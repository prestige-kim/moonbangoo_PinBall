(function () {
  'use strict';
  const P = window.CosmicPinball = window.CosmicPinball || {};
  P.SOUND_CONFIG = {
    voices: 10, hitInterval: 0.085, master: 0.35,
    themes: {
      cosmic: { wave: 'sine', root: 130.81, filter: 2600, overtone: 2, decay: 1.05 },
      candy: { wave: 'triangle', root: 174.61, filter: 3400, overtone: 2.5, decay: 1.15 },
      gold: { wave: 'sine', root: 146.83, filter: 3100, overtone: 3, decay: 1.35 },
      ice: { wave: 'sine', root: 196, filter: 4600, overtone: 4, decay: 1.4 }
    }
  };
  class AudioEngine {
    constructor() {
      this.context = null;
      this.master = null;
      this.enabled = true;
      this.volume = P.SOUND_CONFIG.master;
      this.theme = 'cosmic';
      this.voices = 0;
      this.lastHit = -1;
      this.noiseBuffer = null;
    }
    unlock() {
      if (!this.enabled) return;
      try {
        if (!this.context) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return;
          this.context = new AudioContext();
          this.master = this.context.createGain();
          this.master.gain.value = this.volume * 0.42;
          this.master.connect(this.context.destination);
        }
        if (this.context.state === 'suspended') this.context.resume().catch(function () {});
      } catch (_) { this.context = null; }
    }
    configure(settings) {
      this.enabled = !!settings.sound;
      this.volume = Math.max(0, Math.min(1, Number(settings.volume)));
      this.theme = settings.theme || 'cosmic';
      if (this.master && this.context) {
        this.master.gain.setTargetAtTime(this.enabled ? this.volume * 0.42 : 0, this.context.currentTime, 0.035);
      }
    }
    tone(frequency, duration, strength, delay, glide) {
      const ctx = this.context;
      if (!this.enabled || !ctx || ctx.state !== 'running' || this.voices >= P.SOUND_CONFIG.voices) return;
      const theme = P.SOUND_CONFIG.themes[this.theme] || P.SOUND_CONFIG.themes.cosmic;
      duration *= theme.decay || 1;
      const start = ctx.currentTime + (delay || 0);
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      oscillator.type = theme.wave;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (glide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, glide), start + duration);
      filter.type = 'lowpass';
      filter.frequency.value = theme.filter;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, strength), start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      this.voices++;
      oscillator.onended = () => {
        this.voices--;
        oscillator.disconnect(); filter.disconnect(); gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    }
    blastBody(power) {
      const ctx = this.context;
      if (!this.enabled || !ctx || ctx.state !== 'running' || this.voices >= P.SOUND_CONFIG.voices) return;
      const start = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(150 + power * 40, start);
      oscillator.frequency.exponentialRampToValueAtTime(48, start + 0.12);
      oscillator.frequency.exponentialRampToValueAtTime(34, start + 0.62);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2 + power * 0.14, start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.035, start + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.62);
      oscillator.connect(gain);
      gain.connect(this.master);
      this.voices++;
      oscillator.onended = () => {
        this.voices--;
        oscillator.disconnect(); gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + 0.65);
    }
    air(duration, strength, delay, lowStart, lowEnd, highpass) {
      const ctx = this.context;
      if (!this.enabled || !ctx || ctx.state !== 'running' || this.voices >= P.SOUND_CONFIG.voices) return;
      if (!this.noiseBuffer) {
        this.noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.9), ctx.sampleRate);
        const samples = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      const start = ctx.currentTime + (delay || 0);
      const source = ctx.createBufferSource();
      const high = ctx.createBiquadFilter();
      const low = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      source.buffer = this.noiseBuffer;
      high.type = 'highpass'; high.frequency.value = highpass;
      low.type = 'lowpass';
      low.Q.value = 0.55;
      low.frequency.setValueAtTime(lowStart, start);
      low.frequency.exponentialRampToValueAtTime(lowEnd, start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(strength, start + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(high); high.connect(low); low.connect(gain); gain.connect(this.master);
      this.voices++;
      source.onended = () => {
        this.voices--;
        source.disconnect(); high.disconnect(); low.disconnect(); gain.disconnect();
      };
      source.start(start);
      source.stop(start + duration + 0.02);
    }
    play(type, intensity, variant) {
      if (!this.enabled || !this.context) return;
      const config = P.SOUND_CONFIG;
      const theme = config.themes[this.theme] || config.themes.cosmic;
      const root = theme.root;
      const power = Math.max(0.1, Math.min(1, Number(intensity) || 0.5));
      if (type === 'cannon') {
        // Three restrained layers give the muzzle flash a sharp attack and a deep tail.
        this.blastBody(power);
        this.air(0.19, 0.06 + power * 0.05, 0, 4600, 1000, 180);
        this.air(0.58, 0.04 + power * 0.045, 0.025, 2000, 300, 90);
      } else if (type === 'charge') {
        this.air(0.36, 0.022, 0, 700, 1500, 350);
        this.tone(root * 3.2, 0.075, 0.035, 0.12, root * 1.2);
      } else if (type === 'hit') {
        const now = this.context.currentTime;
        if (now - this.lastHit < config.hitInterval) return;
        this.lastHit = now;
        this.tone(root * (1.8 + power * 2.8), 0.07 + power * 0.08, 0.025 + power * 0.075, 0, root * 1.2);
      } else if (type === 'bumper') {
        this.tone(root * 2, 0.2, 0.18, 0, root);
        this.tone(root * theme.overtone, 0.14, 0.07, 0.015);
      } else if (type === 'skill' && variant === 'pulse') {
        this.tone(root * 0.75, 0.3, 0.18, 0, root * 0.35);
        this.tone(root * 3, 0.12, 0.07, 0.03, root * 1.5);
      } else if (type === 'skill' && variant === 'grow') {
        this.tone(root * 0.8, 0.4, 0.13, 0, root * 1.6);
        this.tone(root * 1.2, 0.3, 0.09, 0.12, root * 2.4);
      } else if (type === 'boost' || type === 'skill') {
        this.tone(root, 0.28, 0.15, 0, root * 4);
        this.tone(root * 1.5, 0.25, 0.06, 0.025, root * 6);
      } else if (type === 'portal') {
        this.tone(root * 4, 0.38, 0.18, 0, root * 0.5);
        this.tone(root * 3, 0.3, 0.08, 0.04, root);
      } else if (type === 'countdown') {
        this.tone(root * 2, 0.25, 0.2, 0);
        this.tone(root * 4, 0.15, 0.07, 0.03);
      } else if (type === 'go') {
        [1, 1.25, 1.5, 2].forEach((note, i) => this.tone(root * note * 2, 0.32, 0.17, i * 0.055));
      } else if (type === 'lead') {
        this.tone(root * 3, 0.16, 0.11, 0);
        this.tone(root * 4, 0.22, 0.12, 0.08);
      } else if (type === 'finish') {
        this.tone(root * 2, 0.24, 0.1, 0);
        this.tone(root * 3, 0.27, 0.09, 0.06);
      } else if (type === 'win') {
        [1, 1.125, 1.25, 1.5, 2, 1.5, 2, 2.25].forEach((note, i) => this.tone(root * note, 0.55, 0.14, i * 0.17));
      }
    }
  }
  P.AudioEngine = AudioEngine;
})();

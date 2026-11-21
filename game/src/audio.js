// Solmar City — sound, synthesized live with WebAudio.
// No audio files: every sound is an oscillator or a burst of noise,
// and the music is a small bass-and-pad loop. The context is created
// on the first user gesture, so the browser's autoplay rules are met.
export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    musicGain: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    muted: false,
    musicTimer: null,
    step: 0,
  };

  audio.ensure = function () {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    audio.musicGain = audio.ctx.createGain();
    audio.musicGain.gain.value = 0.16;
    audio.musicGain.connect(audio.master);
    // Engine hum: two detuned saws through a low-pass filter.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    const engineOsc2 = audio.ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 55.7;
    const engineFilter = audio.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    engineOsc2.start();
    audio.engineOsc2 = engineOsc2;
    // Police siren: a triangle that the game wobbles between two tones.
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'triangle';
    audio.sirenOsc.frequency.value = 720;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
  };

  function noiseBuffer(duration) {
    const ctx = audio.ctx;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  audio.blip = function (freq, duration, type, volume) {
    if (!audio.ctx || audio.muted) return;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume || 0.2, audio.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start();
    osc.stop(audio.ctx.currentTime + duration);
  };

  audio.shot = function () {
    if (!audio.ctx || audio.muted) return;
    const src = audio.ctx.createBufferSource();
    src.buffer = noiseBuffer(0.14);
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 900;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(0.5, audio.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.14);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start();
  };

  audio.crash = function () {
    if (!audio.ctx || audio.muted) return;
    const src = audio.ctx.createBufferSource();
    src.buffer = noiseBuffer(0.25);
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(0.4, audio.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.25);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start();
  };

  audio.explosion = function () {
    if (!audio.ctx || audio.muted) return;
    const src = audio.ctx.createBufferSource();
    src.buffer = noiseBuffer(0.7);
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(0.7, audio.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.7);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start();
    audio.blip(70, 0.5, 'sine', 0.4);
  };

  audio.pickup = function () {
    audio.blip(880, 0.09, 'sine', 0.22);
    setTimeout(() => audio.blip(1318, 0.12, 'sine', 0.22), 80);
  };

  audio.missionDone = function () {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => audio.blip(n, 0.22, 'triangle', 0.25), i * 110));
  };

  audio.fail = function () {
    const notes = [392, 330, 262];
    notes.forEach((n, i) => setTimeout(() => audio.blip(n, 0.3, 'sawtooth', 0.15), i * 160));
  };

  // Engine pitch follows speed; siren wobbles while any cop is near.
  audio.update = function (speedNorm, sirenOn, time) {
    if (!audio.ctx) return;
    const target = audio.muted ? 0 : 0.02 + speedNorm * 0.075;
    audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.08);
    const freq = 52 + speedNorm * 105;
    audio.engineOsc.frequency.setTargetAtTime(freq, audio.ctx.currentTime, 0.08);
    audio.engineOsc2.frequency.setTargetAtTime(freq * 1.008, audio.ctx.currentTime, 0.08);
    const sirenTarget = sirenOn && !audio.muted ? 0.05 : 0;
    audio.sirenGain.gain.setTargetAtTime(sirenTarget, audio.ctx.currentTime, 0.15);
    if (sirenOn) audio.sirenOsc.frequency.value = 660 + Math.sin(time * 5.2) * 190;
  };

  audio.setMuted = function (muted) {
    audio.muted = muted;
    if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
  };

  // A lazy bass-and-pad loop: Am – F – C – G, one bar each.
  const BASS = [55, 43.65, 65.41, 49];
  const CHORDS = [
    [220, 261.63, 329.63],
    [174.61, 220, 261.63],
    [261.63, 329.63, 392],
    [196, 246.94, 293.66],
  ];

  audio.startMusic = function () {
    if (!audio.ctx || audio.musicTimer) return;
    audio.musicTimer = setInterval(() => {
      if (audio.muted || !audio.ctx) return;
      const bar = audio.step % 4;
      audio.step += 1;
      const now = audio.ctx.currentTime;
      const bass = audio.ctx.createOscillator();
      bass.type = 'triangle';
      bass.frequency.value = BASS[bar];
      const bassGain = audio.ctx.createGain();
      bassGain.gain.setValueAtTime(0.0001, now);
      bassGain.gain.exponentialRampToValueAtTime(0.5, now + 0.1);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);
      bass.connect(bassGain);
      bassGain.connect(audio.musicGain);
      bass.start(now);
      bass.stop(now + 2);
      for (const f of CHORDS[bar]) {
        const pad = audio.ctx.createOscillator();
        pad.type = 'sine';
        pad.frequency.value = f;
        const padGain = audio.ctx.createGain();
        padGain.gain.setValueAtTime(0.0001, now);
        padGain.gain.exponentialRampToValueAtTime(0.05, now + 0.5);
        padGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);
        pad.connect(padGain);
        padGain.connect(audio.musicGain);
        pad.start(now);
        pad.stop(now + 2);
      }
    }, 2000);
  };

  audio.stopMusic = function () {
    if (audio.musicTimer) {
      clearInterval(audio.musicTimer);
      audio.musicTimer = null;
    }
  };

  return audio;
}

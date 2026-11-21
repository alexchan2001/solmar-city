// Solmar City — effects: particles, skid marks, tracers, smoke.
// Everything visual that is not the city or a character lives here,
// so the renderer stays a pure function of the world.
import { range } from './random.js';

export function createEffects() {
  const effects = {
    particles: [],
    skids: [],
    tracers: [],
    smokes: [],
  };

  effects.burst = function (x, y, count, color, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = range(Math.random, 0, Math.PI * 2);
      const s = range(Math.random, speed * 0.3, speed);
      effects.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: range(Math.random, 0.35, 0.8),
        maxLife: 0.8,
        color,
        size: range(Math.random, 2, 5),
      });
    }
  };

  effects.smoke = function (x, y) {
    effects.smokes.push({ x, y, life: 1.4, maxLife: 1.4, size: range(Math.random, 8, 14) });
  };

  effects.tracer = function (x1, y1, x2, y2) {
    effects.tracers.push({ x1, y1, x2, y2, life: 0.09, maxLife: 0.09 });
  };

  effects.skid = function (x, y, angle) {
    effects.skids.push({ x, y, angle, life: 6 });
    if (effects.skids.length > 400) effects.skids.splice(0, effects.skids.length - 400);
  };

  effects.step = function (dt) {
    for (const p of effects.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.4 * dt;
      p.vy *= 1 - 2.4 * dt;
      p.life -= dt;
    }
    effects.particles = effects.particles.filter((p) => p.life > 0);
    for (const s of effects.smokes) {
      s.life -= dt;
      s.y -= 14 * dt;
      s.size += 12 * dt;
    }
    effects.smokes = effects.smokes.filter((s) => s.life > 0);
    for (const t of effects.tracers) t.life -= dt;
    effects.tracers = effects.tracers.filter((t) => t.life > 0);
    for (const s of effects.skids) s.life -= dt;
    effects.skids = effects.skids.filter((s) => s.life > 0);
  };

  return effects;
}

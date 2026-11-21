// Solmar City — rendering.
// One canvas, one camera, everything drawn in world space and then
// the HUD in screen space. The look is a sun-soaked top-down city:
// warm light, long shadows, flat colours with a darker wall under
// every roof so the buildings read as solid.
import { WORLD, COLORS } from './config.js';
import { clamp } from './random.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const renderer = { ctx, canvas };

  renderer.resize = function (w, h) {
    canvas.width = w;
    canvas.height = h;
  };

  renderer.render = function (world) {
    const cam = world.camera;
    const w = canvas.width;
    const h = canvas.height;
    const shakeX = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
    const shakeY = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x + shakeX, -cam.y + shakeY);

    const view = {
      x0: cam.x - w / 2 / cam.zoom - 60,
      y0: cam.y - h / 2 / cam.zoom - 60,
      x1: cam.x + w / 2 / cam.zoom + 60,
      y1: cam.y + h / 2 / cam.zoom + 60,
    };
    drawGround(ctx, world, view);
    drawRoads(ctx, world, view);
    drawBlocks(ctx, world, view);
    drawSkids(ctx, world, view);
    drawPickups(ctx, world, view);
    drawCars(ctx, world, view);
    drawPeds(ctx, world, view);
    drawPlayer(ctx, world, view);
    drawParticles(ctx, world, view);
    drawWaypoint(ctx, world, view);
    drawLighting(ctx, world, view, w, h, cam);
    ctx.restore();
  };

  return renderer;
}

function inView(view, x, y, m) {
  return x > view.x0 - m && x < view.x1 + m && y > view.y0 - m && y < view.y1 + m;
}

function drawGround(ctx, world, view) {
  // Grass base.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  // Beach sand and ocean on the south edge.
  if (view.y1 > WORLD.beachY) {
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(view.x0, Math.max(view.y0, WORLD.beachY), view.x1 - view.x0, Math.min(view.y1, WORLD.waterY) - Math.max(view.y0, WORLD.beachY));
  }
  if (view.y1 > WORLD.waterY) {
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(view.x0, Math.max(view.y0, WORLD.waterY), view.x1 - view.x0, view.y1 - Math.max(view.y0, WORLD.waterY));
    ctx.fillStyle = COLORS.waterDeep;
    for (let x = Math.floor(view.x0 / 90) * 90; x < view.x1; x += 90) {
      ctx.fillRect(x, WORLD.waterY + 40 + ((x / 90) % 3) * 18, 46, 5);
    }
  }
}

function drawRoads(ctx, world, view) {
  const half = WORLD.roadWidth / 2;
  ctx.fillStyle = COLORS.road;
  for (const c of world.city.roadSet) {
    if (c > view.y0 - half && c < view.y1 + half) ctx.fillRect(view.x0, c - half, view.x1 - view.x0, WORLD.roadWidth);
    if (c > view.x0 - half && c < view.x1 + half) ctx.fillRect(c - half, view.y0, WORLD.roadWidth, view.y1 - view.y0);
  }
  // Centre dashes.
  ctx.fillStyle = COLORS.roadLine;
  for (const c of world.city.roadSet) {
    if (c > view.y0 - 4 && c < view.y1 + 4) {
      for (let x = Math.floor(view.x0 / 64) * 64; x < view.x1; x += 64) ctx.fillRect(x, c - 2, 30, 4);
    }
    if (c > view.x0 - 4 && c < view.x1 + 4) {
      for (let y = Math.floor(view.y0 / 64) * 64; y < view.y1; y += 64) ctx.fillRect(c - 2, y, 4, 30);
    }
  }
  // Crosswalks at intersections: zebra stripes across each approach.
  ctx.fillStyle = 'rgba(232, 228, 200, 0.75)';
  for (const p of world.city.intersections) {
    if (!inView(view, p.x, p.y, 80)) continue;
    // Stripes across the vertical road, just above and below the crossing.
    for (let i = -3; i <= 3; i += 1) {
      const sx = p.x + i * 11;
      ctx.fillRect(sx - 3, p.y - half - 12, 6, 12);
      ctx.fillRect(sx - 3, p.y + half, 6, 12);
    }
    // Stripes across the horizontal road, just left and right of the crossing.
    for (let i = -3; i <= 3; i += 1) {
      const sy = p.y + i * 11;
      ctx.fillRect(p.x - half - 12, sy - 3, 12, 6);
      ctx.fillRect(p.x + half, sy - 3, 12, 6);
    }
  }
}

function drawBlocks(ctx, world, view) {
  for (const b of world.city.blocks) {
    if (b.x > view.x1 || b.x + b.w < view.x0 || b.y > view.y1 || b.y + b.h < view.y0) continue;
    // Sidewalk border.
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(b.x - WORLD.sidewalk, b.y - WORLD.sidewalk, b.w + WORLD.sidewalk * 2, b.h + WORLD.sidewalk * 2);
    if (b.type === 'park') {
      ctx.fillStyle = '#5d9e4a';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#4a8ac2';
      ctx.beginPath();
      ctx.ellipse(b.x + b.w * 0.68, b.y + b.h * 0.62, 34, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.type === 'parking') {
      ctx.fillStyle = '#4a4f5a';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(232, 228, 200, 0.6)';
      ctx.lineWidth = 2;
      for (let x = b.x + 20; x < b.x + b.w - 10; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x, b.y + 8);
        ctx.lineTo(x, b.y + 26);
        ctx.stroke();
      }
    } else if (b.type === 'plaza') {
      ctx.fillStyle = '#c9bfa8';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#4a8ac2';
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d8ecf7';
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = COLORS.grassDark;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
  }
  // Buildings: a wall offset for height, then the roof, then windows.
  for (const b of world.city.buildings) {
    if (b.x > view.x1 || b.x + b.w < view.x0 || b.y > view.y1 || b.y + b.h < view.y0) continue;
    const h = b.height;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y + h * 0.4, b.w, b.h - h * 0.4 + h * 0.4);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fillRect(b.x, b.y, b.w, 5);
    ctx.fillStyle = 'rgba(20, 30, 50, 0.55)';
    const cols = Math.floor(b.w / 22);
    const rows = Math.floor(b.h / 22);
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        ctx.fillRect(b.x + 8 + i * 22, b.y + 9 + j * 22, 10, 12);
      }
    }
    if (b.name) {
      ctx.fillStyle = '#20242e';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h + 16);
    }
  }
  // Trees and palms.
  for (const t of world.city.trees) {
    if (!inView(view, t.x, t.y, 30)) continue;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(t.x + 5, t.y + 6, t.r * 0.9, t.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.palm ? '#2f6b2a' : COLORS.palm;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSkids(ctx, world, view) {
  ctx.strokeStyle = 'rgba(20, 20, 24, 0.4)';
  ctx.lineWidth = 4;
  for (const s of world.effects.skids) {
    if (!inView(view, s.x, s.y, 20)) continue;
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 8, s.y - Math.sin(s.angle) * 8);
    ctx.lineTo(s.x + Math.cos(s.angle) * 8, s.y + Math.sin(s.angle) * 8);
    ctx.stroke();
  }
}

function drawPickups(ctx, world, view) {
  for (const pk of world.pickups) {
    if (pk.taken || !inView(view, pk.x, pk.y, 30)) continue;
    const bob = Math.sin(world.time * 3 + pk.x) * 3;
    if (pk.kind === 'health') {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(pk.x - 11, pk.y - 11 + bob, 22, 22);
      ctx.fillStyle = '#d8443c';
      ctx.fillRect(pk.x - 3, pk.y - 8 + bob, 6, 16);
      ctx.fillRect(pk.x - 8, pk.y - 3 + bob, 16, 6);
    } else {
      ctx.fillStyle = '#2c2c34';
      ctx.fillRect(pk.x - 11, pk.y - 8 + bob, 22, 16);
      ctx.fillStyle = '#f2c230';
      ctx.fillRect(pk.x - 7, pk.y - 4 + bob, 5, 8);
      ctx.fillRect(pk.x - 1, pk.y - 4 + bob, 5, 8);
      ctx.fillRect(pk.x + 5, pk.y - 4 + bob, 5, 8);
    }
  }
}

function drawCar(ctx, car, view, isPlayer) {
  if (!inView(view, car.x, car.y, 60)) return;
  ctx.save();
  ctx.translate(car.x, car.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  roundRect(ctx, -19, -9 + 4, 40, 22, 8);
  ctx.fill();
  ctx.rotate(car.angle);
  // Body.
  const len = 42;
  const wid = 22;
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  // Roof and windshield.
  ctx.fillStyle = 'rgba(20, 30, 50, 0.85)';
  roundRect(ctx, -4, -wid / 2 + 3, 14, wid - 6, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(200, 220, 240, 0.75)';
  ctx.fillRect(len / 2 - 10, -wid / 2 + 3, 4, wid - 6);
  // Wheels.
  ctx.fillStyle = '#14141a';
  ctx.fillRect(-14, -wid / 2 - 3, 9, 5);
  ctx.fillRect(6, -wid / 2 - 3, 9, 5);
  ctx.fillRect(-14, wid / 2 - 2, 9, 5);
  ctx.fillRect(6, wid / 2 - 2, 9, 5);
  // Headlights.
  ctx.fillStyle = '#fff6c8';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 3, 4);
  ctx.fillRect(len / 2 - 2, wid / 2 - 6, 3, 4);
  if (car.brakeLights) {
    ctx.fillStyle = '#ff2a1a';
    ctx.fillRect(-len / 2 - 1, -wid / 2 + 2, 3, 4);
    ctx.fillRect(-len / 2 - 1, wid / 2 - 6, 3, 4);
  }
  if (car.kind === 'police') {
    const flash = Math.floor(Date.now() / 280) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2a1a' : '#2a6aff';
    ctx.fillRect(-2, -wid / 2 + 2, 6, 5);
    ctx.fillStyle = flash ? '#2a6aff' : '#ff2a1a';
    ctx.fillRect(-2, wid / 2 - 7, 6, 5);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#20242e';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', -11, 3);
  }
  if (car.smoking) {
    ctx.fillStyle = 'rgba(90, 90, 90, 0.5)';
    ctx.beginPath();
    ctx.arc(-6, -4, 8 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (isPlayer) {
    // Player marker: a small ring so the eye finds the car at once.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(car.x, car.y, 30, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawCars(ctx, world, view) {
  for (const car of world.cars) {
    if (car.dead) continue;
    drawCar(ctx, car, view, world.player.car === car);
  }
}

function drawPed(ctx, ped, view, world) {
  if (ped.dead && ped.deadTimer > 20) return;
  if (!inView(view, ped.x, ped.y, 30)) return;
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.dead) {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(12, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  // Shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = ped.speed > 10 ? Math.sin(world.time * 10 + ped.x) * 2 : 0;
  ctx.rotate(ped.angle);
  ctx.fillStyle = ped.pants;
  ctx.fillRect(-4, -5 + bob * 0.4, 8, 10);
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(7, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  if (ped.kind === 'cop') {
    ctx.fillStyle = '#20242e';
    ctx.fillRect(2, -6, 5, 12);
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(4, -3, 2, 6);
  }
  ctx.restore();
  if (ped.fare && ped.state === 'fare') {
    ctx.fillStyle = '#f2c230';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 22 + Math.sin(world.time * 3) * 3, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', ped.x, ped.y - 18 + Math.sin(world.time * 3) * 3);
  }
}

function drawPeds(ctx, world, view) {
  for (const ped of world.peds) drawPed(ctx, ped, view, world);
}

function drawPlayer(ctx, world, view) {
  const p = world.player;
  if (p.inCar || !inView(view, p.x, p.y, 40)) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(2, 5, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = p.moving ? Math.sin(p.walkPhase) * 2 : 0;
  ctx.rotate(p.angle);
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(-5, -6 + bob * 0.3, 10, 12);
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath();
  ctx.arc(9, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20242e';
  ctx.beginPath();
  ctx.arc(9, -2, 6.5, Math.PI, 0);
  ctx.fill();
  if (p.weapon === 'pistol') {
    ctx.fillStyle = '#20242e';
    ctx.fillRect(8, -2, 16, 4);
  }
  ctx.restore();
  // Player ring.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
  ctx.stroke();
}

function drawParticles(ctx, world, view) {
  for (const s of world.effects.smokes) {
    if (!inView(view, s.x, s.y, 40)) continue;
    ctx.fillStyle = `rgba(120, 120, 120, ${0.35 * (s.life / s.maxLife)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of world.effects.particles) {
    if (!inView(view, p.x, p.y, 20)) continue;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const t of world.effects.tracers) {
    ctx.strokeStyle = `rgba(255, 220, 90, ${t.life / t.maxLife})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
}

function drawWaypoint(ctx, world, view) {
  const m = world.mission;
  if (!m || !m.active || !m.waypoint) return;
  if (world.fare) return;
  const wp = m.waypoint;
  if (!inView(view, wp.x, wp.y, 200)) {
    // Off-screen: draw an edge arrow pointing at it, placed where
    // the ray from the camera to the waypoint meets the view edge.
    const cam = world.camera;
    const w = view.x1 - view.x0;
    const h = view.y1 - view.y0;
    const dx = wp.x - cam.x;
    const dy = wp.y - cam.y;
    const ang = Math.atan2(dy, dx);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const mx = w / 2 - 50;
    const my = h / 2 - 50;
    let t = Infinity;
    if (cos !== 0) t = Math.min(t, mx / Math.abs(cos));
    if (sin !== 0) t = Math.min(t, my / Math.abs(sin));
    const ex = cam.x + cos * t;
    const ey = cam.y + sin * t;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.fillStyle = '#f2c230';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }
  const pulse = 1 + Math.sin(world.time * 4) * 0.15;
  // Beacon column of light.
  const grad = ctx.createLinearGradient(wp.x, wp.y - 260, wp.x, wp.y);
  grad.addColorStop(0, 'rgba(242, 194, 48, 0)');
  grad.addColorStop(1, 'rgba(242, 194, 48, 0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(wp.x - 14, wp.y - 260, 28, 260);
  ctx.save();
  ctx.translate(wp.x, wp.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#f2c230';
  ctx.fillRect(-13 * pulse, -13 * pulse, 26 * pulse, 26 * pulse);
  ctx.fillStyle = '#20242e';
  ctx.fillRect(-7 * pulse, -7 * pulse, 14 * pulse, 14 * pulse);
  ctx.restore();
}

function drawLighting(ctx, world, view, w, h, cam) {
  // Warm afternoon sun: a soft radial glow, then a dusk tint by the clock.
  const hour = world.clock;
  let dusk = 0;
  if (hour >= 18) dusk = clamp((hour - 18) / 2.5, 0, 0.55);
  else if (hour < 6) dusk = 0.55;
  const grad = ctx.createRadialGradient(
    cam.x - 400, cam.y - 400, 100,
    cam.x, cam.y, Math.max(w, h),
  );
  grad.addColorStop(0, 'rgba(255, 214, 140, 0.10)');
  grad.addColorStop(1, 'rgba(255, 180, 90, 0.02)');
  ctx.fillStyle = grad;
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  if (dusk > 0) {
    ctx.fillStyle = `rgba(40, 40, 110, ${dusk})`;
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    ctx.fillStyle = `rgba(255, 120, 60, ${dusk * 0.5})`;
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  }
  // Vignette.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

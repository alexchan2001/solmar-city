// Solmar City — the HUD.
// Wanted stars, health, money, speed, the mission objective, the
// clock, messages and the crosshair — all drawn on the canvas in
// screen space, so the screenshots carry the whole game at a glance.
import { PLAYER, CAR } from './config.js';
import { clamp, dist } from './random.js';
import { drawMinimap } from './minimap.js';

export function drawHUD(ctx, world, w, h) {
  const p = world.player;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Wanted stars, top-left.
  const starY = 34;
  for (let i = 0; i < 5; i += 1) {
    ctx.font = '28px system-ui, sans-serif';
    ctx.fillStyle = i < world.wanted ? '#ffd23c' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 18 + i * 30, starY);
  }
  if (world.wanted > 0) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#ffd23c';
    ctx.fillText('WANTED', 18, starY + 22);
  }

  // Money.
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.fillText(`$${p.money.toLocaleString('en-US')}`, 18, 78);
  ctx.shadowBlur = 0;

  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(18, 90, 170, 14);
  ctx.fillStyle = p.health > 50 ? '#3ca66a' : p.health > 25 ? '#f2c230' : '#d8443c';
  ctx.fillRect(18, 90, 170 * clamp(p.health / PLAYER.health, 0, 1), 14);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(18, 90, 170, 14);
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('HEALTH', 18, 116);

  // Weapon and ammo.
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  const weapon = p.weapon === 'pistol' ? `PISTOL  ${p.ammo}` : 'FISTS';
  ctx.fillText(weapon, 18, 136);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('1 fists · 2 pistol · F punch · click shoot', 18, 154);

  // Minimap, top-right, with the clock under it.
  const mapSize = 184;
  drawMinimap(ctx, world, w - mapSize - 16, 16, mapSize);
  const hour = Math.floor(world.clock);
  const min = Math.floor((world.clock - hour) * 60);
  const clockText = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.fillText(clockText, w - 16, 16 + mapSize + 24);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('SOLMAR CITY', w - 16, 16 + mapSize + 42);
  ctx.textAlign = 'left';

  // Mission objective, bottom-left.
  const m = world.mission;
  if (m && m.active) {
    const px = p.inCar && p.car ? p.car.x : p.x;
    const py = p.inCar && p.car ? p.car.y : p.y;
    const d = m.waypoint ? Math.round(dist(px, py, m.waypoint.x, m.waypoint.y)) : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const lines = [m.def.title, m.waypoint ? `${m.waypoint.label} — ${d}m` : ''];
    ctx.fillRect(16, h - 84, 340, 68);
    ctx.fillStyle = '#f2c230';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`◆ ${lines[0]}`, 28, h - 58);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(lines[1], 28, h - 36);
    if (m.timer !== null && m.timer !== undefined) {
      ctx.fillStyle = m.timer < 30 ? '#ff5a3c' : '#ffffff';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(`⏱ ${Math.ceil(m.timer)}s`, 28, h - 18);
    }
    if (m.def.id === 'bigscore' && m.stage === 0 && m.holdProgress > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(16, h - 104, 340, 12);
      ctx.fillStyle = '#f2c230';
      ctx.fillRect(16, h - 104, 340 * clamp(m.holdProgress / 5, 0, 1), 12);
    }
  } else if (world.fare) {
    const d = Math.round(dist(p.car.x, p.car.y, world.fare.dest.x, world.fare.dest.y));
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(16, h - 84, 340, 68);
    ctx.fillStyle = '#f2c230';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('◆ Taxi Fare', 28, h - 58);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`Drop the fare off — ${d}m`, 28, h - 36);
  }

  // Speed, bottom-right, while driving.
  if (p.inCar && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
    ctx.textAlign = 'right';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText(`${kmh}`, w - 66, h - 28);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('km/h', w - 24, h - 28);
    ctx.shadowBlur = 0;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('E exit car · Space handbrake', w - 16, h - 56);
    ctx.textAlign = 'left';
  } else {
    ctx.textAlign = 'right';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('WASD move · Shift run · E enter car', w - 16, h - 24);
    ctx.textAlign = 'left';
  }

  // Messages, centre-top.
  ctx.textAlign = 'center';
  let my = 30;
  for (const msg of world.messages) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const tw = ctx.measureText(msg.text).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(w / 2 - tw / 2 - 12, my - 18, tw + 24, 26);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(msg.text, w / 2, my);
    my += 32;
  }
  ctx.textAlign = 'left';

  // Crosshair while aiming the pistol.
  if (!p.inCar && p.weapon === 'pistol') {
    const mx = world.input ? world.input.mouseX : w / 2;
    const my2 = world.input ? world.input.mouseY : h / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my2, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 14, my2);
    ctx.lineTo(mx - 6, my2);
    ctx.moveTo(mx + 6, my2);
    ctx.lineTo(mx + 14, my2);
    ctx.moveTo(mx, my2 - 14);
    ctx.lineTo(mx, my2 - 6);
    ctx.moveTo(mx, my2 + 6);
    ctx.lineTo(mx, my2 + 14);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawTitle(ctx, world, w, h) {
  ctx.save();
  // Sun-soaked title backdrop: warm gradient over the city.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#ff9e5e');
  grad.addColorStop(0.55, '#ff7a6e');
  grad.addColorStop(1, '#2b3a67');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.2, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.2, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 12;
  ctx.font = 'bold 74px system-ui, sans-serif';
  ctx.fillText('SOLMAR CITY', w / 2, h * 0.34);
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText('An open-world crime game in the spirit of GTA 6', w / 2, h * 0.34 + 42);
  ctx.shadowBlur = 0;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  const lines = [
    'Rico Vega just got out of the docks with empty pockets and a fast right foot.',
    'Mama Rosa has work. Vince has plans. The city has everything — if you can take it.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.52 + i * 26));
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#f2c230';
  ctx.fillText('▶  NEW GAME  —  press Enter', w / 2, h * 0.66);
  if (world.hasSave) {
    ctx.fillStyle = '#ffffff';
    ctx.fillText('◆  CONTINUE  —  press C', w / 2, h * 0.66 + 36);
  }
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('WASD move · Shift run · E enter / steal car · F punch · 1/2 weapons · click shoot · M mute · P pause', w / 2, h - 40);
  ctx.restore();
}

export function drawPause(ctx, world, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(10, 14, 28, 0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', w / 2, h * 0.4);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('P or Esc — resume · M — mute · R — restart the run', w / 2, h * 0.4 + 40);
  ctx.fillText('Your progress saves automatically when a job ends.', w / 2, h * 0.4 + 68);
  ctx.restore();
}

export function drawEnd(ctx, world, w, h, kind) {
  ctx.save();
  ctx.fillStyle = kind === 'busted' ? 'rgba(20, 40, 90, 0.78)' : 'rgba(90, 10, 10, 0.78)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED!' : 'WASTED!', w / 2, h * 0.38);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(
    kind === 'busted'
      ? 'The Solmar PD caught up with you. $150 fine, and the job is blown.'
      : 'Solmar City got the better of you this time. Half your cash is gone.',
    w / 2,
    h * 0.38 + 44,
  );
  ctx.fillStyle = '#f2c230';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('Press Enter to get back on the street', w / 2, h * 0.62);
  ctx.restore();
}

export function drawCard(ctx, world, w, h) {
  const card = world.card;
  if (!card) return;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 14, 28, 0.66)';
  ctx.fillRect(0, 0, w, h);
  const bw = Math.min(620, w - 80);
  const bh = 250;
  const bx = (w - bw) / 2;
  const by = (h - bh) / 2;
  ctx.fillStyle = '#1d2436';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#f2c230';
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f2c230';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`JOB — ${card.giver.toUpperCase()}`, bx + 28, by + 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(card.title, bx + 28, by + 82);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  wrapText(ctx, card.body, bx + 28, by + 116, bw - 56, 24);
  ctx.fillStyle = '#f2c230';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Press Enter to start the job', w / 2, by + bh - 22);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

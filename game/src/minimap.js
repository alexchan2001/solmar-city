// Solmar City — the minimap.
// A small top-down map in the corner of the HUD: roads, the beach,
// the player, the mission waypoint, police and fares. The player is
// always at its centre; the world slides under it.
import { WORLD } from './config.js';
import { clamp } from './random.js';

export function drawMinimap(ctx, world, x, y, size) {
  const scale = size / WORLD.size;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  // Sea and sand.
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(x, y + (WORLD.beachY * scale), size, (WORLD.waterY - WORLD.beachY) * scale);
  // Land.
  ctx.fillStyle = '#7fae5a';
  ctx.fillRect(x, y, size, WORLD.beachY * scale);
  // Roads.
  ctx.fillStyle = '#3a3f4a';
  for (const c of world.city.roadSet) {
    ctx.fillRect(x, y + c * scale - 1, size, 2);
    ctx.fillRect(x + c * scale - 1, y, 2, WORLD.beachY * scale);
  }
  // Parks.
  ctx.fillStyle = '#5d9e4a';
  for (const b of world.city.blocks) {
    if (b.type === 'park') ctx.fillRect(x + b.x * scale, y + b.y * scale, b.w * scale, b.h * scale);
  }
  const px = world.player.inCar && world.player.car ? world.player.car.x : world.player.x;
  const py = world.player.inCar && world.player.car ? world.player.car.y : world.player.y;

  // Mission waypoint.
  const m = world.mission;
  if (m && m.active && m.waypoint) {
    const pulse = 6 + Math.sin(world.time * 4) * 2;
    ctx.fillStyle = '#f2c230';
    ctx.beginPath();
    ctx.arc(x + m.waypoint.x * scale, y + m.waypoint.y * scale, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#20242e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Fare destination.
  if (world.fare) {
    ctx.fillStyle = '#e8823c';
    ctx.beginPath();
    ctx.arc(x + world.fare.dest.x * scale, y + world.fare.dest.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#2a6aff';
  for (const car of world.cars) {
    if (car.kind !== 'police' || car.dead) continue;
    ctx.beginPath();
    ctx.arc(x + car.x * scale, y + car.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fares waiting.
  ctx.fillStyle = '#f2c230';
  for (const ped of world.peds) {
    if (ped.fare && ped.state === 'fare' && !ped.dead) {
      ctx.beginPath();
      ctx.arc(x + ped.x * scale, y + ped.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The player, always on top, with a heading tick.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + px * scale, y + py * scale, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e84c3d';
  ctx.beginPath();
  ctx.arc(x + px * scale, y + py * scale, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // North tick.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', x + size / 2, y + 12);
  ctx.restore();
  // Frame.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, size, size);
}

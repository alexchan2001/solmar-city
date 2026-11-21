// Solmar City — vehicles: car physics, traffic, stealing.
// Cars are simple arcade bodies: a heading, a forward speed and a
// lateral slide. The player's car answers the keys; traffic follows
// the road grid and turns at intersections; police cars chase.
import { CAR, TRAFFIC, WORLD, COLORS } from './config.js';
import { clamp, angleDiff, dist, pick, range } from './random.js';
import { nearestRoadCentre, lanePoint } from './city.js';

let nextCarId = 1;

export function makeCar(x, y, angle, kind, color) {
  return {
    id: nextCarId,
    x,
    y,
    angle,
    speed: 0,
    slide: 0,
    color: color || pick(Math.random, COLORS.carColors),
    kind: kind || 'traffic', // traffic | parked | police | player | taxi
    health: CAR.health,
    driver: kind === 'traffic',
    target: null, // traffic: next intersection
    dir: 0, // traffic: 0 east, 1 south, 2 west, 3 north
    stuck: 0,
    brakeLights: false,
    siren: false,
    smoking: false,
    dead: false,
  };
}

// Arcade car physics: accelerate along the heading, steer more when
// slow, bleed sideways speed for grip, drag at the top end.
export function stepPlayerCar(car, input, dt) {
  const forward = input.up ? 1 : input.down ? -1 : 0;
  const steerInput = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const speedFactor = clamp(Math.abs(car.speed) / 120, 0, 1);
  const steerRate = CAR.steer * (0.55 + 0.45 * (1 - speedFactor));
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steerInput * steerRate * dt * dir * (input.handbrake ? 1.5 : 1);

  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) {
    if (car.speed > 30) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  } else {
    car.speed -= car.speed * 1.4 * dt;
  }
  if (input.handbrake) {
    car.speed -= car.speed * 2.2 * dt;
    car.slide += steerInput * 260 * dt * dir;
  }
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  if (Math.abs(car.speed) < 4 && forward === 0) car.speed = 0;

  // Split velocity into forward and lateral, damp the lateral.
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let vx = fx * car.speed + -fy * car.slide;
  let vy = fy * car.speed + fx * car.slide;
  car.slide -= car.slide * CAR.grip * dt;
  const drag = 1 - CAR.drag * dt * 0.12;
  vx *= drag;
  vy *= drag;
  car.x += vx * dt;
  car.y += vy * dt;
  car.speed = vx * fx + vy * fy;
  car.brakeLights = forward < 0 || input.handbrake;
  return { vx, vy, drifting: Math.abs(car.slide) > 60 };
}

// Traffic: pick a road, drive its right-hand lane, turn at
// intersections, stop for nothing but a jam ahead.
export function stepTrafficCar(car, world, dt) {
  const city = world.city;
  if (!car.target) {
    car.target = pickIntersectionNear(city, car.x, car.y, car.dir);
    if (!car.target) return;
  }
  const t = car.target;
  const d = dist(car.x, car.y, t.x, t.y);
  const wantAngle = Math.atan2(t.y - car.y, t.x - car.x);
  car.angle += clamp(angleDiff(car.angle, wantAngle), -2.2 * dt, 2.2 * dt);
  // Slow for the car ahead.
  let slow = 1;
  for (const other of world.cars) {
    if (other === car || other.dead) continue;
    const od = dist(car.x, car.y, other.x, other.y);
    if (od < 70) {
      const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
      if (ahead > 0 && od < 70) slow = 0.25;
    }
  }
  const targetSpeed = TRAFFIC.speed * slow;
  car.speed += clamp(targetSpeed - car.speed, -300 * dt, 220 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (d < 26) {
    // Reached the intersection: choose the next leg, never a U-turn.
    const choices = [0, 1, 2, 3].filter((dd) => dd !== (car.dir + 2) % 4);
    car.dir = choices[Math.floor(Math.random() * choices.length)];
    car.target = nextIntersection(city, t, car.dir);
    if (!car.target) car.target = t;
  }
}

function pickIntersectionNear(city, x, y, dir) {
  let best = null;
  let bestD = Infinity;
  for (const p of city.intersections) {
    const d = dist(x, y, p.x, p.y);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

function nextIntersection(city, from, dir) {
  const step = WORLD.pitch;
  const nx = from.x + (dir === 0 ? step : dir === 2 ? -step : 0);
  const ny = from.y + (dir === 1 ? step : dir === 3 ? -step : 0);
  if (nx < 100 || nx > WORLD.size - 100 || ny < 100 || ny > WORLD.size - 100) return null;
  return { x: nx, y: ny };
}

// Police chase: steer hard at the player, ram, and keep up.
export function stepPoliceCar(car, world, dt) {
  const player = world.player;
  const px = player.inCar ? player.car.x : player.x;
  const py = player.inCar ? player.car.y : player.y;
  const wantAngle = Math.atan2(py - car.y, px - car.x);
  const d = dist(car.x, car.y, px, py);
  car.angle += clamp(angleDiff(car.angle, wantAngle), -3.4 * dt, 3.4 * dt);
  const targetSpeed = d > 260 ? 520 : 470;
  car.speed += clamp(targetSpeed - car.speed, -500 * dt, 380 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.siren = true;
  // Ram the player's car: a shove and damage on contact.
  if (player.inCar && d < 44) {
    const push = 260 * dt;
    player.car.x += Math.cos(car.angle) * push;
    player.car.y += Math.sin(car.angle) * push;
    player.car.health -= 6 * dt;
    world.shake = Math.min(10, world.shake + 3 * dt);
    if (player.car.health <= 0 && !player.car.dead) explodeCar(world, player.car);
  }
  if (d > 1500) car.dead = true; // lost the player, despawn
}

export function explodeCar(world, car) {
  car.dead = true;
  car.health = 0;
  world.effects.burst(car.x, car.y, 26, '#ff7a2a', 260);
  world.effects.burst(car.x, car.y, 18, '#ffd23c', 180);
  world.effects.burst(car.x, car.y, 12, '#3a3f4a', 120);
  world.audio.explosion();
  world.shake = 14;
  if (world.player.car === car) {
    world.player.inCar = false;
    world.player.car = null;
    world.player.x = car.x + 30;
    world.player.y = car.y + 30;
    world.player.health -= 25;
    world.addMessage('Your car blew up!');
  }
}

// Keep cars inside the world and out of buildings.
export function collideWorld(car, world) {
  car.x = clamp(car.x, 30, WORLD.size - 30);
  car.y = clamp(car.y, 30, WORLD.size - 30);
  for (const b of world.city.buildings) {
    if (car.x > b.x - 16 && car.x < b.x + b.w + 16 && car.y > b.y - 16 && car.y < b.y + b.h + 16) {
      // Push out along the smallest overlap.
      const dxl = car.x - (b.x - 16);
      const dxr = b.x + b.w + 16 - car.x;
      const dyt = car.y - (b.y - 16);
      const dyb = b.y + b.h + 16 - car.y;
      const m = Math.min(dxl, dxr, dyt, dyb);
      if (m === dxl) car.x = b.x - 16;
      else if (m === dxr) car.x = b.x + b.w + 16;
      else if (m === dyt) car.y = b.y - 16;
      else car.y = b.y + b.h + 16;
      if (Math.abs(car.speed) > 120) {
        car.health -= 8;
        world.audio.crash();
        world.effects.burst(car.x, car.y, 6, '#e8e8e8', 90);
        world.shake = Math.min(9, world.shake + 2);
      }
      car.speed *= 0.55;
    }
  }
  if (car.y > WORLD.beachY + 40 && car.y < WORLD.waterY) {
    // Sand slows cars down.
    car.speed *= 1 - 0.5 * 0.016;
  }
  if (car.y >= WORLD.waterY) {
    car.y = WORLD.waterY - 4;
    car.speed *= 0.5;
  }
}

// Simple circle-vs-circle car collision: push apart, swap a little speed.
export function collideCars(world) {
  const cars = world.cars;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const min = 40;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 140) {
          a.health -= impact * 0.03;
          b.health -= impact * 0.03;
          world.effects.burst((a.x + b.x) / 2, (a.y + b.y) / 2, 5, '#ffd23c', 110);
          if (a === world.player.car || b === world.player.car) {
            world.audio.crash();
            world.shake = Math.min(8, world.shake + 2);
          }
        }
        const tmp = a.speed;
        a.speed = a.speed * 0.7 + b.speed * 0.3;
        b.speed = b.speed * 0.7 + tmp * 0.3;
      }
    }
  }
}

// Solmar City — pedestrians.
// They stroll the sidewalks, cross at corners, and run when something
// scary happens: a gunshot, a car on the pavement, a body on the ground.
// A few wear a yellow $ and want a taxi — the free-roam fares.
import { PEDS, WORLD } from './config.js';
import { clamp, dist, pick, range } from './random.js';
import { randomSidewalkPoint } from './city.js';

const SHIRTS = ['#e84c3d', '#3c7ad8', '#e8c33c', '#3ca66a', '#c96fd8', '#e8823c', '#e8e8e8', '#8a6fb0'];
const PANTS = ['#2c3e50', '#5a4632', '#3a3f4a', '#6e5a7a'];

export function makePed(world, x, y) {
  const rng = world.rng;
  return {
    x,
    y,
    angle: range(rng, 0, Math.PI * 2),
    speed: 0,
    state: 'walk', // walk | flee | dead | fare | passenger
    target: null,
    shirt: pick(rng, SHIRTS),
    pants: pick(rng, PANTS),
    skin: pick(rng, ['#f2c89b', '#d9a06b', '#a06b3f', '#f7d7b0']),
    fear: 0,
    wait: range(rng, 0, 3),
    fare: false,
    dead: false,
    deadTimer: 0,
  };
}

export function spawnPeds(world) {
  for (let i = 0; i < PEDS.count; i += 1) {
    const p = randomSidewalkPoint(world.rng, world.city);
    const ped = makePed(world, p.x, p.y);
    world.peds.push(ped);
  }
  // A few fares waiting at the cab stand and the hotel.
  for (let i = 0; i < 3; i += 1) {
    const spot = world.city.landmarks.cabstand || world.city.landmarks.hotel;
    if (!spot) break;
    const ped = makePed(world, spot.x + (i - 1) * 40, spot.y + 30);
    ped.fare = true;
    ped.state = 'fare';
    world.peds.push(ped);
  }
}

function nearestSidewalkTarget(world, ped) {
  return randomSidewalkPoint(world.rng, world.city);
}

export function stepPeds(world, dt) {
  const player = world.player;
  for (const ped of world.peds) {
    if (ped.dead) {
      ped.deadTimer += dt;
      continue;
    }
    // Fear: gunshots, nearby speeding cars, a dead body.
    let fear = 0;
    if (world.gunshotTimer > 0) fear = Math.max(fear, 0.7);
    for (const car of world.cars) {
      if (car.dead) continue;
      const d = dist(ped.x, ped.y, car.x, car.y);
      if (d < 90 && Math.abs(car.speed) > 200) fear = Math.max(fear, 1);
      else if (d < 46) fear = Math.max(fear, 0.8);
    }
    if (world.player.inCar) {
      const d = dist(ped.x, ped.y, player.car.x, player.car.y);
      if (d < 60 && Math.abs(player.car.speed) > 260) fear = 1;
    }
    ped.fear = Math.max(0, Math.max(fear, ped.fear - dt * 0.25));

    if (ped.state === 'fare' || ped.state === 'passenger') continue;

    if (ped.fear > 0.45) {
      ped.state = 'flee';
      // Run away from the player / the nearest car.
      const tx = player.inCar ? player.car.x : player.x;
      const ty = player.inCar ? player.car.y : player.y;
      const away = Math.atan2(ped.y - ty, ped.x - tx);
      ped.angle += clamp(((away - ped.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -4 * dt, 4 * dt);
      ped.speed = PEDS.fleeSpeed;
    } else {
      ped.state = 'walk';
      ped.wait -= dt;
      if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 14 || ped.wait <= 0) {
        ped.target = nearestSidewalkTarget(world, ped);
        ped.wait = range(world.rng, 2, 7);
      }
      const want = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      ped.angle += clamp(((want - ped.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -2.5 * dt, 2.5 * dt);
      ped.speed = PEDS.walkSpeed;
    }
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    ped.x = clamp(ped.x, 20, WORLD.size - 20);
    ped.y = clamp(ped.y, 20, WORLD.waterY - 10);
  }
  // Bodies fade out; keep the street from filling with them.
  world.peds = world.peds.filter((p) => !p.dead || p.deadTimer < 25);
  // Top the crowd back up.
  while (world.peds.length < PEDS.count) {
    const p = randomSidewalkPoint(world.rng, world.city);
    world.peds.push(makePed(world, p.x, p.y));
  }
}

// A pedestrian hit by a car: knocked down, counted as a crime if seen.
export function hitPed(world, ped, byPlayer) {
  if (ped.dead) return;
  ped.dead = true;
  ped.deadTimer = 0;
  world.effects.burst(ped.x, ped.y, 10, '#c0392b', 130);
  if (byPlayer) {
    world.commitCrime('hitPed', ped.x, ped.y);
    world.stats.pedsHit += 1;
  }
}

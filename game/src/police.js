// Solmar City — the wanted level and the Solmar PD.
// Crimes raise heat. While a cop can see the player, heat holds; once
// the player is out of sight for a while, stars fall one at a time.
// Police cars chase and ram; on foot, officers chase and arrest.
// At three stars and up they shoot.
import { POLICE, WANTED, WORLD, CAR } from './config.js';
import { clamp, dist, range } from './random.js';
import { makeCar, stepPoliceCar } from './vehicles.js';
import { isOnRoad } from './city.js';

export function wantedFor(world) {
  return world.wanted;
}

// A crime at (x, y): raise the level, mark the player seen.
export function commitCrime(world, kind, x, y) {
  const add = WANTED[kind] || 1;
  const before = world.wanted;
  world.wanted = clamp(world.wanted + add, 0, 5);
  world.lastSeenAt = world.time;
  world.lastSeenX = x;
  world.lastSeenY = y;
  if (world.wanted > before) {
    world.addMessage(
      world.wanted >= 3 ? 'WANTED — the whole PD is coming!' : 'Wanted level up!',
    );
    world.audio.blip(220, 0.3, 'square', 0.15);
  }
}

// Can any police unit see the player right now?
export function policeCanSee(world) {
  const player = world.player;
  const px = player.inCar ? player.car.x : player.x;
  const py = player.inCar ? player.car.y : player.y;
  for (const car of world.cars) {
    if (car.kind !== 'police' || car.dead) continue;
    if (dist(car.x, car.y, px, py) < 520) return true;
  }
  for (const ped of world.peds) {
    if (ped.kind !== 'cop' || ped.dead) continue;
    if (dist(ped.x, ped.y, px, py) < 320) return true;
  }
  return false;
}

export function stepWanted(world, dt) {
  if (world.wanted === 0) return;
  if (policeCanSee(world)) {
    world.lastSeenAt = world.time;
    return;
  }
  // Hidden: after a delay, stars fall one at a time.
  if (world.time - world.lastSeenAt > WANTED.coolDelay) {
    world.coolTimer += dt;
    if (world.coolTimer >= WANTED.coolStep) {
      world.coolTimer = 0;
      world.wanted -= 1;
      if (world.wanted === 0) world.addMessage('You lost the cops. Lay low.');
      else world.addMessage('Wanted level down — keep hiding.');
    }
  }
}

export function stepPolice(world, dt) {
  const player = world.player;
  const px = player.inCar ? player.car.x : player.x;
  const py = player.inCar ? player.car.y : player.y;

  // Spawn police cars to match the wanted level.
  const wantCars = Math.min(POLICE.maxCars, world.wanted === 0 ? 0 : world.wanted >= 4 ? 5 : world.wanted >= 2 ? 3 : 2);
  const haveCars = world.cars.filter((c) => c.kind === 'police' && !c.dead).length;
  if (haveCars < wantCars) {
    const angle = range(world.rng, 0, Math.PI * 2);
    const r = 700;
    let x = px + Math.cos(angle) * r;
    let y = py + Math.sin(angle) * r;
    x = clamp(x, 60, WORLD.size - 60);
    y = clamp(y, 60, WORLD.size - 60);
    // Put the new unit on a road when one is near.
    if (!isOnRoad(world.city, x, y)) {
      const c = world.city.intersections[Math.floor(world.rng() * world.city.intersections.length)];
      x = c.x;
      y = c.y;
    }
    const car = makeCar(x, y, Math.atan2(py - y, px - x), 'police', '#20242e');
    car.speed = 200;
    world.cars.push(car);
  }

  // On-foot officers when the player is on foot and wanted.
  const wantCops = !player.inCar && world.wanted > 0 ? Math.min(3, world.wanted) : 0;
  const haveCops = world.peds.filter((p) => p.kind === 'cop' && !p.dead).length;
  if (haveCops < wantCops) {
    const angle = range(world.rng, 0, Math.PI * 2);
    const cop = {
      x: clamp(px + Math.cos(angle) * 320, 30, WORLD.size - 30),
      y: clamp(py + Math.sin(angle) * 320, 30, WORLD.waterY - 10),
      angle: 0,
      speed: 0,
      state: 'chase',
      kind: 'cop',
      shirt: '#2b4a7a',
      pants: '#20242e',
      skin: '#d9a06b',
      fear: 0,
      wait: 0,
      shootTimer: 1,
      arrestTimer: 0,
      dead: false,
      deadTimer: 0,
    };
    world.peds.push(cop);
  }

  // Police cars chase; on-foot cops chase and arrest.
  for (const car of world.cars) {
    if (car.kind !== 'police' || car.dead) continue;
    if (world.wanted === 0) {
      car.dead = true;
      continue;
    }
    stepPoliceCar(car, world, dt);
  }

  for (const ped of world.peds) {
    if (ped.kind !== 'cop' || ped.dead) continue;
    if (world.wanted === 0) {
      ped.dead = true;
      continue;
    }
    const d = dist(ped.x, ped.y, px, py);
    const want = Math.atan2(py - ped.y, px - ped.x);
    ped.angle += clamp(((want - ped.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -5 * dt, 5 * dt);
    ped.speed = player.inCar ? 0 : 185;
    if (!player.inCar) {
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    if (!player.inCar && d < 30) {
      ped.arrestTimer += dt;
      if (ped.arrestTimer > POLICE.arrestTime) {
        world.busted();
      }
    } else {
      ped.arrestTimer = 0;
    }
    // Officers open fire from three stars up.
    if (world.wanted >= POLICE.shootFromStars && d < POLICE.shootRange && d > 40) {
      ped.shootTimer -= dt;
      if (ped.shootTimer <= 0) {
        ped.shootTimer = POLICE.shootCooldown + range(world.rng, 0, 0.5);
        world.effects.tracer(ped.x, ped.y, px, py);
        world.audio.shot();
        if (world.rng() < 0.45) {
          player.health -= POLICE.shootDamage;
          world.effects.burst(px, py, 4, '#c0392b', 90);
          world.addMessage('You are being shot at!');
          if (player.health <= 0) world.wasted();
        }
      }
    }
  }
}

export function clearWanted(world) {
  world.wanted = 0;
  world.coolTimer = 0;
  for (const car of world.cars) if (car.kind === 'police') car.dead = true;
  for (const ped of world.peds) if (ped.kind === 'cop') ped.dead = true;
}

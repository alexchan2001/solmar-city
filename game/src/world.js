// Solmar City — the world: state, the player, combat, and the step.
// Everything the game simulates lives in one object so the renderer,
// the minimap and the screenshot stager all read the same truth.
import { PLAYER, CAR, WORLD, START_MONEY } from './config.js';
import { clamp, dist, range } from './random.js';
import { generateCity } from './city.js';
import { makeCar, stepPlayerCar, stepTrafficCar, collideWorld, collideCars, explodeCar } from './vehicles.js';
import { spawnPeds, stepPeds, hitPed } from './pedestrians.js';
import { stepWanted, stepPolice, commitCrime as policeCommitCrime, clearWanted } from './police.js';
import { startMission, stepMissions, stepFares } from './missions.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';

export function createWorld(seed, saveData) {
  const rng = (() => {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const city = generateCity(seed);
  const world = {
    seed,
    rng,
    city,
    time: 0,
    clock: 16.5, // 4:30 PM, golden hour in Solmar City
    cars: [],
    peds: [],
    effects: createEffects(),
    audio: createAudio(),
    input: null,
    player: {
      x: 1250,
      y: 1650,
      angle: -Math.PI / 2,
      health: PLAYER.health,
      money: saveData ? saveData.money : START_MONEY,
      inCar: false,
      car: null,
      weapon: 'fists',
      ammo: PLAYER.ammoStart,
      punchTimer: 0,
      shootTimer: 0,
      walkPhase: 0,
      moving: false,
    },
    wanted: 0,
    lastSeenAt: -100,
    lastSeenX: 0,
    lastSeenY: 0,
    coolTimer: 0,
    mission: { index: saveData ? saveData.missionIndex : 0, active: false, done: false },
    nextMissionAt: 0.5,
    nextMissionIndex: saveData ? saveData.missionIndex : 0,
    fare: null,
    nextFareAt: null,
    messages: [],
    card: null,
    stats: {
      missionsDone: saveData ? saveData.missionIndex : 0,
      carsStolen: 0,
      pedsHit: 0,
      shotsFired: 0,
      earned: 0,
    },
    pickups: [],
    camera: { x: 1250, y: 1650, zoom: 1 },
    shake: 0,
    gunshotTimer: 0,
    state: 'title', // title | playing | paused | busted | wasted | story
    stateTimer: 0,
  };

  // Helpers the subsystems call on the world.
  world.commitCrime = (kind, x, y) => policeCommitCrime(world, kind, x, y);
  world.addMessage = (text) => {
    world.messages.push({ text, t: world.time });
    if (world.messages.length > 3) world.messages.shift();
  };
  world.showCard = (title, body, giver) => {
    if (world.suppressCards) return; // screenshot staging: no cards
    world.card = { title, body, giver };
    world.state = 'story';
  };
  world.dismissCard = () => {
    world.card = null;
    if (world.state === 'story') world.state = 'playing';
  };
  world.busted = () => {
    if (world.state !== 'playing') return;
    const fine = Math.min(world.player.money, 150);
    world.player.money -= fine;
    world.player.health = PLAYER.health;
    clearWanted(world);
    world.state = 'busted';
    world.stateTimer = 0;
    world.audio.fail();
    if (world.mission.active) {
      world.mission.active = false;
      world.nextMissionAt = world.time + 5;
      world.nextMissionIndex = world.mission.index;
    }
  };
  world.wasted = () => {
    if (world.state !== 'playing') return;
    world.player.money = Math.floor(world.player.money / 2);
    world.player.health = PLAYER.health;
    clearWanted(world);
    world.state = 'wasted';
    world.stateTimer = 0;
    world.audio.fail();
    if (world.mission.active) {
      world.mission.active = false;
      world.nextMissionAt = world.time + 5;
      world.nextMissionIndex = world.mission.index;
    }
  };

  // Traffic and parked cars.
  for (let i = 0; i < 22; i += 1) {
    const p = city.intersections[Math.floor(rng() * city.intersections.length)];
    const dir = Math.floor(rng() * 4);
    const car = makeCar(p.x + range(rng, -20, 20), p.y + range(rng, -20, 20), (dir * Math.PI) / 2, 'traffic');
    car.dir = dir;
    car.speed = range(rng, 120, 180);
    world.cars.push(car);
  }
  for (let i = 0; i < 16; i += 1) {
    const b = city.blocks[Math.floor(rng() * city.blocks.length)];
    if (!b || b.type !== 'parking') continue;
    const car = makeCar(b.x + range(rng, 30, b.w - 30), b.y + range(rng, 30, b.h - 30), range(rng, 0, Math.PI * 2), 'parked');
    world.cars.push(car);
  }
  // The player's starter car, a tired sedan by the apartment.
  const starter = makeCar(1250, 1710, -Math.PI / 2, 'parked', '#5a7fa6');
  starter.owner = 'player';
  world.cars.push(starter);

  spawnPeds(world);
  spawnPickups(world);
  return world;
}

function spawnPickups(world) {
  const spots = [
    world.city.landmarks.hospital,
    world.city.landmarks.bank,
    world.city.landmarks.hotel,
    world.city.landmarks.docks,
  ];
  for (const spot of spots) {
    if (!spot) continue;
    world.pickups.push({ x: spot.x + 60, y: spot.y + 60, kind: 'health', taken: false, respawnAt: 0 });
    world.pickups.push({ x: spot.x - 60, y: spot.y + 60, kind: 'ammo', taken: false, respawnAt: 0 });
  }
}

function stepPlayerOnFoot(world, input, dt) {
  const p = world.player;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  p.moving = len > 0;
  if (len > 0) {
    mx /= len;
    my /= len;
    const speed = input.sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.walkPhase += speed * dt * 0.06;
    if (p.weapon !== 'pistol') p.angle = Math.atan2(my, mx);
  }
  // Aim with the mouse when armed.
  if (p.weapon === 'pistol') {
    const cam = world.camera;
    const wx = cam.x + (input.mouseX - world.viewW / 2) / cam.zoom;
    const wy = cam.y + (input.mouseY - world.viewH / 2) / cam.zoom;
    p.angle = Math.atan2(wy - p.y, wx - p.x);
  }
  p.x = clamp(p.x, 20, WORLD.size - 20);
  p.y = clamp(p.y, 20, WORLD.waterY - 8);
  // Buildings are solid on foot too.
  for (const b of world.city.buildings) {
    if (p.x > b.x - 10 && p.x < b.x + b.w + 10 && p.y > b.y - 10 && p.y < b.y + b.h + 10) {
      const dxl = p.x - (b.x - 10);
      const dxr = b.x + b.w + 10 - p.x;
      const dyt = p.y - (b.y - 10);
      const dyb = b.y + b.h + 10 - p.y;
      const m = Math.min(dxl, dxr, dyt, dyb);
      if (m === dxl) p.x = b.x - 10;
      else if (m === dxr) p.x = b.x + b.w + 10;
      else if (m === dyt) p.y = b.y - 10;
      else p.y = b.y + b.h + 10;
    }
  }
  p.punchTimer -= dt;
  p.shootTimer -= dt;

  // Enter a car.
  if (input.consume('enter')) {
    const car = nearestCar(world, p.x, p.y, CAR.enterRange);
    if (car) enterCar(world, car);
  }
  // Punch.
  if (input.consume('punch') && p.punchTimer <= 0 && p.weapon === 'fists') {
    p.punchTimer = PLAYER.punchCooldown;
    punch(world);
  }
  // Switch weapons.
  if (input.consume('fists')) p.weapon = 'fists';
  if (input.consume('pistol')) p.weapon = 'pistol';
  // Shoot with the mouse.
  if (input.mouseDown && p.weapon === 'pistol' && p.shootTimer <= 0) {
    shoot(world);
  }
}

function nearestCar(world, x, y, maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of world.cars) {
    if (car.dead) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(world, car) {
  const p = world.player;
  // A stolen car is a crime — unless it is yours, or the mission taxi.
  const isTheirs = car.owner === 'player';
  const isMissionTaxi = world.mission.active && world.mission.def.id === 'fare' && world.mission.targetCar === car;
  if (!isTheirs && !isMissionTaxi && car.kind !== 'police') {
    if (car.driver) {
      // Yank the driver out; they run.
      car.driver = false;
      const driver = {
        x: car.x + 24, y: car.y + 24, angle: 0, speed: 0, state: 'flee',
        kind: 'ped', shirt: '#e8823c', pants: '#2c3e50', skin: '#f2c89b',
        fear: 1, wait: 0, fare: false, dead: false, deadTimer: 0,
      };
      world.peds.push(driver);
    }
    world.commitCrime('stealCar', car.x, car.y);
    world.stats.carsStolen += 1;
    world.addMessage('Car stolen! The cops saw that.');
  }
  if (car.kind === 'police') {
    world.addMessage('That one belongs to the PD. Pick another.');
    return;
  }
  car.owner = 'player';
  car.driver = false;
  p.inCar = true;
  p.car = car;
  world.audio.blip(330, 0.08, 'sine', 0.2);
}

function exitCar(world) {
  const p = world.player;
  const car = p.car;
  if (!car) return;
  p.inCar = false;
  p.car = null;
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 30;
  p.y = car.y + Math.sin(side) * 30;
  p.angle = car.angle;
  car.speed *= 0.2;
}

function punch(world) {
  const p = world.player;
  const fx = Math.cos(p.angle);
  const fy = Math.sin(p.angle);
  world.audio.blip(160, 0.08, 'square', 0.2);
  for (const ped of world.peds) {
    if (ped.dead) continue;
    const dx = ped.x - p.x;
    const dy = ped.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < PLAYER.punchRange && dx * fx + dy * fy > 0) {
      if (ped.kind === 'cop') {
        world.commitCrime('punchCop', ped.x, ped.y);
        ped.dead = true;
        ped.deadTimer = 0;
        world.commitCrime('killCop', ped.x, ped.y);
        world.addMessage('You took down a cop! Run!');
      } else {
        hitPed(world, ped, true);
      }
      world.effects.burst(ped.x, ped.y, 6, '#ffd23c', 120);
      return;
    }
  }
}

function shoot(world) {
  const p = world.player;
  if (p.ammo <= 0) {
    world.audio.blip(140, 0.1, 'square', 0.15);
    world.addMessage('Out of ammo — find an ammo pickup.');
    p.shootTimer = 0.4;
    return;
  }
  p.ammo -= 1;
  p.shootTimer = PLAYER.shootCooldown;
  world.stats.shotsFired += 1;
  world.gunshotTimer = 1.2;
  world.audio.shot();
  world.commitCrime('shoot', p.x, p.y);
  const fx = Math.cos(p.angle);
  const fy = Math.sin(p.angle);
  const rangeMax = PLAYER.shootRange;
  let bestD = rangeMax;
  let hit = null;
  let hitKind = null;
  for (const ped of world.peds) {
    if (ped.dead) continue;
    const dx = ped.x - p.x;
    const dy = ped.y - p.y;
    const along = dx * fx + dy * fy;
    if (along < 0 || along > bestD) continue;
    const perp = Math.abs(-dx * fy + dy * fx);
    if (perp < 18) { bestD = along; hit = ped; hitKind = 'ped'; }
  }
  for (const car of world.cars) {
    if (car.dead || car === p.car) continue;
    const dx = car.x - p.x;
    const dy = car.y - p.y;
    const along = dx * fx + dy * fy;
    if (along < 0 || along > bestD) continue;
    const perp = Math.abs(-dx * fy + dy * fx);
    if (perp < 26) { bestD = along; hit = car; hitKind = 'car'; }
  }
  const ex = p.x + fx * bestD;
  const ey = p.y + fy * bestD;
  world.effects.tracer(p.x + fx * 16, p.y + fy * 16, ex, ey);
  world.effects.burst(ex, ey, 4, '#ffd23c', 100);
  if (hitKind === 'ped') {
    hit.dead = true;
    hit.deadTimer = 0;
    if (hit.kind === 'cop') {
      world.commitCrime('killCop', hit.x, hit.y);
      world.addMessage('Cop down! The whole city will hear about this.');
    } else {
      world.commitCrime('killPed', hit.x, hit.y);
      world.stats.pedsHit += 1;
    }
  } else if (hitKind === 'car') {
    hit.health -= PLAYER.shootDamage;
    if (hit.health <= 0) explodeCar(world, hit);
    else if (hit.health < 40) hit.smoking = true;
  }
}

function drivePlayerCar(world, input, dt) {
  const p = world.player;
  const car = p.car;
  const res = stepPlayerCar(car, input, dt);
  if (Math.abs(car.slide) > 60 || (input.handbrake && Math.abs(car.speed) > 80)) {
    world.effects.skid(car.x - Math.cos(car.angle) * 12, car.y - Math.sin(car.angle) * 12, car.angle);
    if (Math.random() < 0.4) world.effects.smoke(car.x, car.y);
  }
  // Run over pedestrians.
  for (const ped of world.peds) {
    if (ped.dead) continue;
    if (dist(car.x, car.y, ped.x, ped.y) < 26 && Math.abs(car.speed) > 120) {
      hitPed(world, ped, true);
      car.speed *= 0.85;
      world.shake = Math.min(8, world.shake + 2);
    }
  }
  // Smoking cars catch fire eventually.
  if (car.health < 40) {
    car.smoking = true;
    if (Math.random() < dt * 0.1) explodeCar(world, car);
  }
  if (input.consume('enter')) exitCar(world);
}

function stepPickups(world, dt) {
  const p = world.player;
  const px = p.inCar ? p.car.x : p.x;
  const py = p.inCar ? p.car.y : p.y;
  for (const pk of world.pickups) {
    if (pk.taken) {
      if (world.time >= pk.respawnAt) pk.taken = false;
      continue;
    }
    if (dist(px, py, pk.x, pk.y) < 34) {
      pk.taken = true;
      pk.respawnAt = world.time + 30;
      if (pk.kind === 'health') {
        p.health = Math.min(PLAYER.health, p.health + 40);
        world.addMessage('Health +40');
      } else {
        p.ammo = Math.min(PLAYER.ammoMax, p.ammo + 24);
        world.addMessage('Ammo +24');
      }
      world.audio.pickup();
    }
  }
}

export function stepWorld(world, input, dt) {
  world.time += dt;
  world.clock = (world.clock + dt / 60) % 24;
  world.gunshotTimer = Math.max(0, world.gunshotTimer - dt);
  const player = world.player;

  if (player.inCar && player.car) drivePlayerCar(world, input, dt);
  else stepPlayerOnFoot(world, input, dt);

  // Traffic and police.
  for (const car of world.cars) {
    if (car.dead) continue;
    if (car.kind === 'traffic' && car !== player.car) stepTrafficCar(car, world, dt);
    if (car.kind === 'parked' && car !== player.car) {
      car.speed *= 1 - 2 * dt;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
    }
    if (car.smoking && Math.random() < dt * 0.5) world.effects.smoke(car.x, car.y - 8);
    collideWorld(car, world);
    if (car.health <= 0 && !car.dead) explodeCar(world, car);
  }
  world.cars = world.cars.filter((c) => !c.dead || c === player.car);
  collideCars(world);

  stepPeds(world, dt);
  stepWanted(world, dt);
  stepPolice(world, dt);
  stepMissions(world, dt);
  stepFares(world, dt);
  stepPickups(world, dt);
  world.effects.step(dt);

  // Health regen out of trouble.
  if (player.health < PLAYER.health && world.wanted === 0) {
    player.health = Math.min(PLAYER.health, player.health + 1.5 * dt);
  }

  // Camera follows the player, zoomed out while driving.
  const targetX = player.inCar && player.car ? player.car.x : player.x;
  const targetY = player.inCar && player.car ? player.car.y : player.y;
  const targetZoom = player.inCar ? 0.72 : 1;
  world.camera.x += (targetX - world.camera.x) * Math.min(1, 5 * dt);
  world.camera.y += (targetY - world.camera.y) * Math.min(1, 5 * dt);
  world.camera.zoom += (targetZoom - world.camera.zoom) * Math.min(1, 2 * dt);
  world.shake = Math.max(0, world.shake - 22 * dt);

  // The mission chain lives in stepMissions: it starts the next job
  // (or retries the failed one) when its time comes.

  // Audio follows the drive.
  const speedNorm = player.inCar && player.car ? Math.abs(player.car.speed) / CAR.maxSpeed : 0;
  const sirenOn = world.cars.some((c) => c.kind === 'police' && !c.dead && dist(c.x, c.y, targetX, targetY) < 700);
  world.audio.update(speedNorm, sirenOn, world.time);

  // Prune old messages.
  world.messages = world.messages.filter((m) => world.time - m.t < 5);
}

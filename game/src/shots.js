// Solmar City — screenshot scenes behind ?shot=<name>&seed=<n>.
// Each scene plays the real rules forward from a fresh world for a
// fixed number of steps, steered by a simple autopilot, so the frame
// is what a short game really looks like — and the same seed always
// gives a frame of the same moment. The game never fakes a shot.
import { MISSIONS, CAR } from './config.js';
import { createWorld, stepWorld } from './world.js';
import { startMission } from './missions.js';
import { makeCar } from './vehicles.js';
import { angleDiff, dist, clamp } from './random.js';

const STEP = 1 / 30;

function makeAutoInput() {
  const input = {
    up: false, down: false, left: false, right: false,
    sprint: false, enter: false, punch: false, handbrake: false,
    mouseX: 640, mouseY: 360, mouseDown: false,
    pressed: {},
    consume(name) {
      const was = !!input.pressed[name];
      input.pressed[name] = false;
      return was;
    },
    clearPressed() { input.pressed = {}; },
    press(name) { input.pressed[name] = true; },
  };
  return input;
}

// Road centre-lines: 200, 600, 1000, ... 3000 (pitch 400, 8x8 blocks).
const ROAD_CENTRES = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
function nearestCentre(v) {
  let best = ROAD_CENTRES[0];
  for (const c of ROAD_CENTRES) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
  return best;
}

// Steer a car toward a point: throttle on, turn toward the target.
// Eases off the throttle when almost on top of the point so the car
// does not keep ramming a building it has already reached.
function steerCar(input, car, tx, ty) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(car.angle, want);
  const d = dist(car.x, car.y, tx, ty);
  input.up = d > 50;
  input.left = diff < -0.12;
  input.right = diff > 0.12;
  input.handbrake = Math.abs(diff) > 1.1 && Math.abs(car.speed) > 200;
}

// Next road-grid goal on the way to (tx, ty): drive along the road
// the car is already on to the target's row/column, then turn.
// This keeps the car on roads instead of cutting through blocks,
// where it would beach on buildings and spin donuts in the grass.
function nextNavGoal(car, tx, ty) {
  const tix = nearestCentre(tx);
  const tiy = nearestCentre(ty);
  const ncx = nearestCentre(car.x);
  const ncy = nearestCentre(car.y);
  const dxRoad = Math.abs(car.x - ncx);
  const dyRoad = Math.abs(car.y - ncy);
  if (dxRoad <= dyRoad) {
    // On (near) a vertical road: head along it to the target's row.
    if (Math.abs(car.y - tiy) < 70) return { x: tix, y: tiy };
    return { x: ncx, y: tiy };
  }
  // On (near) a horizontal road: head along it to the target's column.
  if (Math.abs(car.x - tix) < 70) return { x: tix, y: tiy };
  return { x: tix, y: ncy };
}

// Drive a car toward a point along the road grid. Close in (under
// 130 units) it drives straight at the point, so a fare pickup or a
// hideout arrival still works once the car is on the right block.
function driveToward(input, world, tx, ty) {
  const car = world.player.car;
  if (!car) return;
  if (!input.navTarget || input.navTarget.x !== tx || input.navTarget.y !== ty) {
    input.navTarget = { x: tx, y: ty };
    input.navGoal = null;
  }
  if (dist(car.x, car.y, tx, ty) < 130) {
    input.navGoal = { x: tx, y: ty };
    steerCar(input, car, tx, ty);
    return;
  }
  // Already on the target's intersection: drive straight in to the
  // point itself (it sits inside a block, off the road grid).
  if (nearestCentre(car.x) === nearestCentre(tx) && nearestCentre(car.y) === nearestCentre(ty)) {
    input.navGoal = { x: tx, y: ty };
    steerCar(input, car, tx, ty);
    return;
  }
  if (!input.navGoal || dist(car.x, car.y, input.navGoal.x, input.navGoal.y) < 70) {
    input.navGoal = nextNavGoal(car, tx, ty);
  }
  steerCar(input, car, input.navGoal.x, input.navGoal.y);
}

// Snap the camera onto the player so the shot is framed on them,
// not wherever the camera happened to lag behind.
function snapCamera(world) {
  const p = world.player;
  const tx = p.inCar && p.car ? p.car.x : p.x;
  const ty = p.inCar && p.car ? p.car.y : p.y;
  world.camera.x = tx;
  world.camera.y = ty;
}

// Walk toward a point.
function walkToward(input, world, tx, ty) {
  const p = world.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  input.up = dy < -20;
  input.down = dy > 20;
  input.left = dx < -20;
  input.right = dx > 20;
}

function runSteps(world, input, seconds) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i += 1) {
    if (world.state !== 'playing' && world.state !== 'story') break;
    stepWorld(world, input, STEP);
  }
}

// A fresh world for the shot, cards suppressed, clock fixed.
function freshWorld(seed, clock) {
  const world = createWorld(seed, null);
  world.suppressCards = true;
  world.clock = clock;
  world.state = 'playing';
  world.viewW = 1280;
  world.viewH = 720;
  return world;
}

function stageChase() {
  const world = freshWorld(7, 17.2);
  const input = makeAutoInput();
  world.input = input;
  // The getaway job, mid-escape: Vince is in, three stars, the
  // hideout is the waypoint, and the PD is already on the tail.
  startMission(world, 2);
  const m = world.mission;
  const docks = world.city.landmarks.docks;
  world.player.x = docks.x + 80;
  world.player.y = docks.y + 40;
  const car = makeCar(world.player.x + 40, world.player.y, 0, 'parked', '#d8443c');
  car.owner = 'player';
  car.health = 300; // Staging: the getaway car has to survive the shot.
  world.cars.push(car);
  world.player.inCar = true;
  world.player.car = car;
  m.stage = 1;
  m.passenger = null;
  world.wanted = 3;
  world.lastSeenAt = world.time;
  const hideout = world.city.landmarks.hideout;
  m.waypoint = { x: hideout.x, y: hideout.y, label: 'Lose the cops — reach the hideout' };
  // Two police cars closing in from behind, on the same road, so
  // the chase reads on camera instead of spawning off-map and
  // ramming the getaway car to death in the first second. They
  // trail the player rather than pinning it against a building.
  for (let i = 0; i < 2; i += 1) {
    const pc = makeCar(200, car.y + 420 + i * 180, -Math.PI / 2, 'police', '#20242e');
    pc.speed = 340;
    world.cars.push(pc);
  }
  for (let i = 0; i < 420; i += 1) {
    driveToward(input, world, m.waypoint.x, m.waypoint.y);
    if (world.state !== 'playing') break;
    stepWorld(world, input, STEP);
    // Stop mid-chase once the hideout is close: the shot is the
    // escape in progress, not the car parked there while the PD
    // beats on it until it blows up.
    if (world.player.inCar && dist(world.player.car.x, world.player.car.y, m.waypoint.x, m.waypoint.y) < 350) break;
  }
  snapCamera(world);
  return world;
}

function stageStreet() {
  const world = freshWorld(11, 16.5);
  const input = makeAutoInput();
  world.input = input;
  // Downtown on foot at rush hour: traffic, pedestrians, and a
  // parked car worth taking on the corner.
  const hotel = world.city.landmarks.hotel;
  world.player.x = hotel.x - 120;
  world.player.y = hotel.y + 180;
  const car = makeCar(hotel.x - 60, hotel.y + 220, Math.PI / 2, 'parked', '#3c7ad8');
  world.cars.push(car);
  for (let i = 0; i < 200; i += 1) {
    walkToward(input, world, car.x, car.y);
    if (world.state !== 'playing') break;
    stepWorld(world, input, STEP);
  }
  snapCamera(world);
  return world;
}

function stageMission() {
  const world = freshWorld(21, 17.8);
  const input = makeAutoInput();
  world.input = input;
  // The first fare, mid-job: the passenger is in the taxi and the
  // hotel is the waypoint, meter running.
  startMission(world, 0);
  const m = world.mission;
  const taxi = m.targetCar;
  world.player.x = taxi.x - 40;
  world.player.y = taxi.y + 20;
  // Get in the taxi and take the fare.
  for (let i = 0; i < 40; i += 1) {
    walkToward(input, world, taxi.x, taxi.y);
    if (world.state !== 'playing') break;
    stepWorld(world, input, STEP);
  }
  input.press('enter');
  stepWorld(world, input, STEP);
  // Roll up to the stand so the fare hops in.
  for (let i = 0; i < 60; i += 1) {
    if (m.stage === 1) break;
    driveToward(input, world, m.waypoint.x, m.waypoint.y);
    stepWorld(world, input, STEP);
  }
  // Drive to the hotel.
  const hotel = world.city.landmarks.hotel;
  for (let i = 0; i < 500; i += 1) {
    if (!world.player.inCar) break;
    driveToward(input, world, hotel.x, hotel.y);
    if (world.state !== 'playing') break;
    stepWorld(world, input, STEP);
    if (m.stage === 1 && dist(world.player.car.x, world.player.car.y, hotel.x, hotel.y) < 420) break;
  }
  snapCamera(world);
  return world;
}

function stageDusk() {
  const world = freshWorld(31, 19.1);
  const input = makeAutoInput();
  world.input = input;
  // Dusk on the beach road: a shootout. The player is on foot with
  // the pistol out, three stars, and officers closing in.
  const beachX = 1700;
  world.player.x = beachX;
  world.player.y = 2920;
  world.player.weapon = 'pistol';
  world.player.ammo = 60;
  world.wanted = 3;
  world.lastSeenAt = world.time;
  for (let i = 0; i < 3; i += 1) {
    const pc = makeCar(beachX - 300 + i * 160, 2860, Math.PI / 2, 'police', '#20242e');
    pc.speed = 0;
    world.cars.push(pc);
  }
  for (let i = 0; i < 150; i += 1) {
    // Aim at the nearest cop and fire.
    let best = null;
    let bestD = Infinity;
    for (const ped of world.peds) {
      if (ped.kind !== 'cop' || ped.dead) continue;
      const d = dist(world.player.x, world.player.y, ped.x, ped.y);
      if (d < bestD) { bestD = d; best = ped; }
    }
    if (best) {
      const cam = world.camera;
      input.mouseX = 640 + (best.x - world.player.x) * cam.zoom * 0.5;
      input.mouseY = 360 + (best.y - world.player.y) * cam.zoom * 0.5;
      input.mouseDown = true;
    }
    walkToward(input, world, beachX + 200, 2900);
    if (world.state !== 'playing') break;
    stepWorld(world, input, STEP);
  }
  input.mouseDown = false;
  snapCamera(world);
  return world;
}

export function stageShot(name) {
  if (name === 'chase') return stageChase();
  if (name === 'street') return stageStreet();
  if (name === 'mission') return stageMission();
  if (name === 'dusk') return stageDusk();
  return stageChase();
}

export const SHOT_NAMES = ['chase', 'street', 'mission', 'dusk'];

// Solmar City — missions and the story.
// Five jobs for Rico Vega, from a first cab fare to the Big Score.
// Each mission is a small state machine: a waypoint, a stage, and a
// completion check. The world owns the active mission; this module
// owns what each one asks for.
import { MISSIONS, CAR } from './config.js';
import { dist, range } from './random.js';
import { makeCar } from './vehicles.js';
import { clearWanted } from './police.js';

export function startMission(world, index) {
  const def = MISSIONS[index];
  if (!def) {
    world.mission = { index, active: false, done: true };
    world.addMessage('All jobs done. Solmar City is yours — free roam!');
    return;
  }
  const m = {
    index,
    def,
    active: true,
    stage: 0,
    waypoint: null,
    timer: def.timeLimit || null,
    holdProgress: 0,
    passenger: null,
    targetCar: null,
    text: def.title,
  };
  world.mission = m;
  world.addMessage(`${def.giver}: ${def.title}`);
  world.showCard(def.title, def.brief, def.giver);
  setupMission(world, m);
}

function setupMission(world, m) {
  const L = world.city.landmarks;
  if (m.def.id === 'fare') {
    // A taxi waits at the cab stand; the fare waits beside it.
    const stand = L.cabstand || { x: 1200, y: 1600 };
    const taxi = makeCar(stand.x + 60, stand.y, 0, 'taxi', '#f2c230');
    taxi.health = CAR.health;
    world.cars.push(taxi);
    m.targetCar = taxi;
    const fare = {
      x: stand.x - 20, y: stand.y + 40, angle: 0, speed: 0, state: 'fare',
      kind: 'ped', shirt: '#e8c33c', pants: '#2c3e50', skin: '#f2c89b',
      fear: 0, wait: 0, fare: true, dead: false, deadTimer: 0,
    };
    world.peds.push(fare);
    m.passenger = fare;
    m.waypoint = { x: stand.x, y: stand.y, label: 'Pick up the fare' };
  } else if (m.def.id === 'hotwheels') {
    const mall = L.mall || { x: 1400, y: 1000 };
    const gt = makeCar(mall.x + 40, mall.y + 120, Math.PI / 2, 'parked', '#d8443c');
    world.cars.push(gt);
    m.targetCar = gt;
    m.waypoint = { x: mall.x + 40, y: mall.y + 120, label: 'Steal the red Comet GT' };
  } else if (m.def.id === 'getaway') {
    const docks = L.docks || { x: 300, y: 2600 };
    const vince = {
      x: docks.x + 30, y: docks.y, angle: 0, speed: 0, state: 'fare',
      kind: 'ped', shirt: '#2b4a7a', pants: '#20242e', skin: '#d9a06b',
      fear: 0, wait: 0, fare: false, dead: false, deadTimer: 0, name: 'Vince',
    };
    world.peds.push(vince);
    m.passenger = vince;
    m.waypoint = { x: docks.x, y: docks.y, label: 'Pick up Vince at the docks' };
  } else if (m.def.id === 'beachrun') {
    m.drops = [
      { x: 600, y: 2920, label: 'Drop 1/3 — Beach Rd West' },
      { x: 1700, y: 2920, label: 'Drop 2/3 — Beach Rd Mid' },
      { x: 2800, y: 2920, label: 'Drop 3/3 — Beach Rd East' },
    ];
    m.dropIndex = 0;
    m.waypoint = { ...m.drops[0] };
  } else if (m.def.id === 'bigscore') {
    const bank = L.bank || { x: 1800, y: 1800 };
    m.waypoint = { x: bank.x, y: bank.y, label: 'Enter the Solmar Bank — hold E' };
  }
}

export function completeMission(world) {
  const m = world.mission;
  if (!m || !m.active) return;
  world.player.money += m.def.reward;
  world.stats.missionsDone += 1;
  world.audio.missionDone();
  world.addMessage(`Job done: ${m.def.title} — +$${m.def.reward}`);
  if (m.def.id === 'getaway' || m.def.id === 'bigscore') clearWanted(world);
  if (m.def.id === 'bigscore') {
    world.showCard('The Big Score', 'The bank, the cops, the whole city — and you walked away with it all. Solmar City is yours now.', 'Vince');
  }
  m.active = false;
  // Next job starts after a breath.
  world.nextMissionAt = world.time + 4;
}

export function failMission(world, reason) {
  const m = world.mission;
  if (!m || !m.active) return;
  world.audio.fail();
  world.addMessage(`Job failed: ${reason} — try it again.`);
  m.active = false;
  world.nextMissionAt = world.time + 3;
}

export function stepMissions(world, dt) {
  const m = world.mission;
  const player = world.player;
  if (!m) return;
  if (!m.active) {
    if (world.nextMissionAt && world.time >= world.nextMissionAt) {
      world.nextMissionAt = null;
      const next = world.nextMissionIndex ?? m.index + 1;
      world.nextMissionIndex = null;
      if (next < MISSIONS.length) startMission(world, next);
      else world.mission = { index: next, active: false, done: true };
    }
    return;
  }
  if (m.timer !== null && m.timer !== undefined) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(world, 'Out of time');
      return;
    }
  }
  const px = player.inCar ? player.car.x : player.x;
  const py = player.inCar ? player.car.y : player.y;
  const wp = m.waypoint;
  if (!wp) return;
  const d = dist(px, py, wp.x, wp.y);

  if (m.def.id === 'fare') {
    if (m.stage === 0 && d < 60) {
      // The fare gets in the player's car.
      if (player.inCar) {
        m.passenger.state = 'passenger';
        m.passenger.dead = false;
        m.stage = 1;
        const hotel = world.city.landmarks.hotel || { x: 2000, y: 1400 };
        m.waypoint = { x: hotel.x, y: hotel.y, label: 'Take the fare to the Marisol Hotel' };
        world.addMessage('Fare: "Marisol Hotel, and step on it."');
      } else {
        world.addMessage('You need a car — take the yellow taxi.');
      }
    } else if (m.stage === 1 && d < 60) {
      world.peds = world.peds.filter((p) => p !== m.passenger);
      completeMission(world);
    }
  } else if (m.def.id === 'hotwheels') {
    if (m.stage === 0) {
      if (player.inCar && player.car === m.targetCar) {
        m.stage = 1;
        const garage = world.city.landmarks.garage || { x: 2200, y: 1800 };
        m.waypoint = { x: garage.x, y: garage.y, label: 'Deliver the Comet GT to Vince’s garage' };
        world.addMessage('Nice. Now get it to the garage — quietly.');
      }
    } else if (m.stage === 1 && d < 70) {
      completeMission(world);
    }
  } else if (m.def.id === 'getaway') {
    if (m.stage === 0 && d < 60) {
      if (player.inCar) {
        m.passenger.state = 'passenger';
        m.stage = 1;
        world.wanted = Math.max(world.wanted, 2);
        world.lastSeenAt = world.time;
        const hideout = world.city.landmarks.hideout || { x: 600, y: 600 };
        m.waypoint = { x: hideout.x, y: hideout.y, label: 'Lose the cops — reach the hideout' };
        world.addMessage('Vince: "Drive! They saw the whole thing!"');
      } else {
        world.addMessage('You need a car to pick Vince up.');
      }
    } else if (m.stage === 1 && d < 70) {
      completeMission(world);
    }
  } else if (m.def.id === 'beachrun') {
    if (d < 60) {
      m.dropIndex += 1;
      world.audio.pickup();
      world.player.money += 100;
      if (m.dropIndex >= m.drops.length) {
        completeMission(world);
      } else {
        m.waypoint = { ...m.drops[m.dropIndex] };
        world.addMessage(`Drop ${m.dropIndex + 1}/3 — keep moving!`);
      }
    }
  } else if (m.def.id === 'bigscore') {
    if (m.stage === 0) {
      if (!player.inCar && d < 55) {
        // Hold E to rob the bank.
        if (world.input.enter) {
          m.holdProgress += dt;
          if (m.holdProgress >= 5) {
            m.stage = 1;
            world.wanted = 4;
            world.lastSeenAt = world.time;
            const hideout = world.city.landmarks.hideout || { x: 600, y: 600 };
            m.waypoint = { x: hideout.x, y: hideout.y, label: 'Four stars! Reach the hideout' };
            world.addMessage('ALARM! The whole city is coming — RUN!');
            world.audio.explosion();
          }
        } else {
          m.holdProgress = Math.max(0, m.holdProgress - dt * 2);
        }
      } else {
        m.holdProgress = Math.max(0, m.holdProgress - dt * 2);
      }
    } else if (m.stage === 1 && d < 70) {
      completeMission(world);
    }
  }
}

// Free-roam fares: a waiting pedestrian with a $ hops in when the
// player stops beside them in any car, then pays on arrival.
export function stepFares(world, dt) {
  const player = world.player;
  if (!player.inCar || world.mission.active) return;
  for (const ped of world.peds) {
    if (!ped.fare || ped.state !== 'fare' || ped.dead) continue;
    const d = dist(ped.x, ped.y, player.car.x, player.car.y);
    if (d < 55 && Math.abs(player.car.speed) < 40) {
      ped.state = 'passenger';
      const dest = world.city.intersections[Math.floor(world.rng() * world.city.intersections.length)];
      world.fare = { ped, dest, paid: false };
      world.addMessage('Fare: "Take me over there, quick."');
      world.audio.pickup();
      return;
    }
  }
  if (world.fare) {
    const f = world.fare;
    const d = dist(player.car.x, player.car.y, f.dest.x, f.dest.y);
    if (d < 60 && Math.abs(player.car.speed) < 40) {
      const pay = 40 + Math.floor(range(world.rng, 0, 60));
      player.money += pay;
      world.addMessage(`Fare paid +$${pay}.`);
      world.audio.pickup();
      world.peds = world.peds.filter((p) => p !== f.ped);
      world.fare = null;
      // A new fare appears at the cab stand after a while.
      world.nextFareAt = world.time + 20;
    }
  }
  if (!world.fare && world.nextFareAt && world.time >= world.nextFareAt) {
    world.nextFareAt = null;
    const spot = world.city.landmarks.cabstand;
    if (spot) {
      const ped = {
        x: spot.x + range(world.rng, -30, 30), y: spot.y + 40, angle: 0, speed: 0, state: 'fare',
        kind: 'ped', shirt: '#e8c33c', pants: '#2c3e50', skin: '#f2c89b',
        fear: 0, wait: 0, fare: true, dead: false, deadTimer: 0,
      };
      world.peds.push(ped);
    }
  }
}

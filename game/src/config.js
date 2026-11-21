// Solmar City — configuration and tuning.
// One place for every number the game balances on, so a tweak never
// means hunting through the simulation.
export const WORLD = {
  size: 3200, // world is size x size units; south edge is the beach
  blocks: 8, // 8 x 8 city blocks
  pitch: 400, // distance between road centre-lines
  roadWidth: 72,
  sidewalk: 18,
  beachY: 2960, // below this y the sand starts
  waterY: 3120, // below this y the ocean starts
};

export const PLAYER = {
  walkSpeed: 150,
  runSpeed: 235,
  radius: 13,
  health: 100,
  punchDamage: 25,
  punchRange: 34,
  punchCooldown: 0.38,
  shootCooldown: 0.22,
  shootDamage: 34,
  shootRange: 560,
  ammoStart: 24,
  ammoMax: 120,
};

export const CAR = {
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 540,
  maxReverse: 180,
  steer: 2.6, // radians per second at full lock, scaled by speed
  grip: 6.5, // lateral velocity damping
  drag: 0.55,
  radius: 17,
  health: 100,
  enterRange: 46,
};

export const TRAFFIC = {
  count: 22,
  speed: 165,
  spawnGap: 90,
};

export const PEDS = {
  count: 42,
  walkSpeed: 55,
  fleeSpeed: 150,
};

export const POLICE = {
  maxCars: 6,
  chaseSpeed: 500,
  ramDamage: 12,
  arrestTime: 1.4, // seconds a cop must touch the player on foot
  shootFromStars: 3,
  shootCooldown: 0.9,
  shootDamage: 8,
  shootRange: 420,
};

// Wanted heat: how much each crime adds, and how fast it cools off
// while no police officer can see the player.
export const WANTED = {
  stealCar: 1,
  hitPed: 1,
  killPed: 2,
  punchCop: 1,
  shoot: 1,
  killCop: 2,
  coolDelay: 6, // seconds unseen before the level starts falling
  coolStep: 8, // seconds per star lost while hidden
  bustFine: 150,
};

export const MISSIONS = [
  {
    id: 'fare',
    title: 'First Fare',
    giver: 'Mama Rosa',
    brief:
      'Rosa runs the cab stand on Coral Ave. Pick up the fare at the yellow marker and take him to the Marisol Hotel. Drive like you mean it — the meter is running.',
    reward: 150,
  },
  {
    id: 'hotwheels',
    title: 'Hot Wheels',
    giver: 'Vince',
    brief:
      'Vince wants a red Comet GT, parked behind the mall on Palm Row. Take it — quietly, if you can — and bring it to his garage on 5th. The cops will not like it.',
    reward: 300,
  },
  {
    id: 'getaway',
    title: 'Getaway',
    giver: 'Vince',
    brief:
      'Vince lifted something he should not have. Pick him up at the docks and lose the cops on the way to the hideout. Two stars and counting — drive fast, drive smart.',
    reward: 500,
  },
  {
    id: 'beachrun',
    title: 'Beach Run',
    giver: 'Mama Rosa',
    brief:
      'Three drops along the beach road, and the buyers do not wait. Hit all three markers before the timer runs out. Rosa pays cash, no questions.',
    reward: 600,
    timeLimit: 150,
  },
  {
    id: 'bigscore',
    title: 'The Big Score',
    giver: 'Vince',
    brief:
      'The Solmar Bank. Walk in, hold the floor, walk out rich. Then lose a four-star wanted level and make the hideout. This is the one, Rico. Do not miss.',
    reward: 1500,
  },
];

export const STORY = {
  intro:
    'SOLMAR CITY — sun, sea, and everybody else’s money. Rico Vega just got out of the docks with empty pockets and a fast right foot. Mama Rosa has work. Vince has plans. The city has everything, if you can take it.',
  outro:
    'The Big Score is done. $1,500 richer, four stars lighter, and the whole of Solmar City still out there. Free roam is yours — fares, cars, and trouble, whenever you want them.',
};

export const COLORS = {
  sky: '#ffd9a0',
  grass: '#7fae5a',
  grassDark: '#74a24f',
  sand: '#e8d29a',
  water: '#2f7fb8',
  waterDeep: '#256b9e',
  road: '#3a3f4a',
  roadLine: '#e8e4c8',
  sidewalk: '#b9b3a4',
  buildingRoof: ['#c96f4a', '#5a7fa6', '#8a6fb0', '#4a9e7f', '#b0a05a', '#a65a6e'],
  buildingWall: ['#8a4a30', '#3f5a78', '#5f4a7a', '#2f6e58', '#7a6e3e', '#74384a'],
  palm: '#3f7a3a',
  carColors: ['#d8443c', '#3c7ad8', '#e8c33c', '#e8e8e8', '#2c2c34', '#3ca66a', '#c96fd8', '#e8823c'],
  police: '#20242e',
  taxi: '#f2c230',
  player: '#e84c3d',
  playerShirt: '#f5f0e6',
  cop: '#2b4a7a',
};

export const SAVE_KEY = 'solmar-city-save-v1';
export const START_MONEY = 60;

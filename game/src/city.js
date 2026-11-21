// Solmar City — the city itself.
// One seeded generator builds the whole map: the road grid, the blocks
// with their buildings, parks and parking lots, the beach and the ocean,
// and the named landmarks the missions drive to. The same seed always
// builds the same city.
import { WORLD, COLORS } from './config.js';
import { mulberry32, pick, range, rangeInt } from './random.js';

const ROAD_CENTRES = [];
for (let i = 0; i < WORLD.blocks; i += 1) ROAD_CENTRES.push(200 + i * WORLD.pitch);

const LANDMARK_SPOTS = [
  { key: 'hotel', name: 'Marisol Hotel', block: [4, 3] },
  { key: 'garage', name: "Vince's Garage", block: [5, 4] },
  { key: 'docks', name: 'Solmar Docks', block: [0, 6] },
  { key: 'hideout', name: 'Hideout', block: [1, 1] },
  { key: 'bank', name: 'Solmar Bank', block: [4, 4] },
  { key: 'mall', name: 'Palm Row Mall', block: [3, 2] },
  { key: 'cabstand', name: 'Cab Stand', block: [2, 4] },
  { key: 'hospital', name: 'St. Lucia Hospital', block: [6, 2] },
  { key: 'park', name: 'Coral Park', block: [2, 2] },
];

// A block is the square of land between four roads. Columns and rows
// run 0..8; the outer strips are the city edge blocks.
function blockRect(col, row) {
  const x0 = col === 0 ? 0 : ROAD_CENTRES[col - 1] + WORLD.roadWidth / 2 + WORLD.sidewalk;
  const x1 = col === WORLD.blocks ? WORLD.size : ROAD_CENTRES[col] - WORLD.roadWidth / 2 - WORLD.sidewalk;
  const y0 = row === 0 ? 0 : ROAD_CENTRES[row - 1] + WORLD.roadWidth / 2 + WORLD.sidewalk;
  const y1 = row === WORLD.blocks ? WORLD.size : ROAD_CENTRES[row] - WORLD.roadWidth / 2 - WORLD.sidewalk;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, col, row };
}

export function generateCity(seed) {
  const rng = mulberry32(seed);
  const blocks = [];
  const buildings = [];
  const trees = [];
  const landmarks = {};
  const roadSet = new Set(ROAD_CENTRES);

  for (let row = 0; row <= WORLD.blocks; row += 1) {
    for (let col = 0; col <= WORLD.blocks; col += 1) {
      const rect = blockRect(col, row);
      if (rect.w < 40 || rect.h < 40) continue;
      // The strip south of the beach road is sand, not blocks.
      if (rect.y >= WORLD.beachY) continue;
      const spot = LANDMARK_SPOTS.find((s) => s.block[0] === col && s.block[1] === row);
      let type = 'buildings';
      const roll = rng();
      if (spot && spot.key === 'park') type = 'park';
      else if (roll < 0.14) type = 'park';
      else if (roll < 0.26) type = 'parking';
      else if (roll < 0.32) type = 'plaza';
      const block = { ...rect, type, name: spot ? spot.name : null, key: spot ? spot.key : null };
      blocks.push(block);

      if (type === 'buildings') {
        const count = rangeInt(rng, 2, 4);
        for (let b = 0; b < count; b += 1) {
          const bw = range(rng, 70, Math.min(130, rect.w - 30));
          const bh = range(rng, 60, Math.min(110, rect.h - 30));
          const bx = rect.x + range(rng, 12, Math.max(13, rect.w - bw - 12));
          const by = rect.y + range(rng, 12, Math.max(13, rect.h - bh - 12));
          const color = pick(rng, COLORS.buildingRoof);
          const wall = pick(rng, COLORS.buildingWall);
          const building = { x: bx, y: by, w: bw, h: bh, color, wall, height: rangeInt(rng, 10, 26) };
          buildings.push(building);
          if (spot && b === 0) {
            building.name = spot.name;
            building.key = spot.key;
            landmarks[spot.key] = { x: bx + bw / 2, y: by + bh + 26, name: spot.name, building };
          }
        }
      } else if (type === 'park' || type === 'plaza') {
        const n = type === 'park' ? rangeInt(rng, 8, 14) : rangeInt(rng, 2, 4);
        for (let t = 0; t < n; t += 1) {
          trees.push({
            x: rect.x + range(rng, 16, rect.w - 16),
            y: rect.y + range(rng, 16, rect.h - 16),
            r: range(rng, 9, 15),
            palm: rng() < 0.5,
          });
        }
      }
      if (spot && !landmarks[spot.key]) {
        landmarks[spot.key] = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, name: spot.name };
      }
    }
  }

  // Palm trees along the beach road and the ocean front.
  for (let x = 60; x < WORLD.size; x += 90) {
    trees.push({ x: x + range(rng, -14, 14), y: WORLD.beachY + 24 + range(rng, -6, 6), r: 12, palm: true });
    if (rng() < 0.5) trees.push({ x: x + 45, y: WORLD.beachY + 60 + range(rng, -8, 8), r: 11, palm: true });
  }

  // Intersections: every crossing of a vertical and a horizontal road.
  const intersections = [];
  for (const x of ROAD_CENTRES) {
    for (const y of ROAD_CENTRES) intersections.push({ x, y });
  }

  return { blocks, buildings, trees, landmarks, intersections, roadSet };
}

export function isOnRoad(city, x, y) {
  const half = WORLD.roadWidth / 2;
  for (const c of city.roadSet) {
    if (Math.abs(x - c) <= half || Math.abs(y - c) <= half) return true;
  }
  return false;
}

// The road centre-line nearest to a point (for snapping cars to a lane).
export function nearestRoadCentre(city, x, y) {
  let bestX = null;
  let bestY = null;
  let bestDx = Infinity;
  let bestDy = Infinity;
  for (const c of city.roadSet) {
    const dx = Math.abs(x - c);
    const dy = Math.abs(y - c);
    if (dx < bestDx) { bestDx = dx; bestX = c; }
    if (dy < bestDy) { bestDy = dy; bestY = c; }
  }
  return bestDx <= bestDy ? { axis: 'v', at: bestX, dist: bestDx } : { axis: 'h', at: bestY, dist: bestDy };
}

// A point on a road, on the right-hand lane for the given heading.
export function lanePoint(x, y, heading) {
  const off = WORLD.roadWidth / 4;
  const dx = Math.cos(heading);
  const dy = Math.sin(heading);
  // Right-hand side: perpendicular clockwise from the heading.
  return { x: x - dy * off, y: y + dx * off };
}

export function randomRoadPoint(rng, city) {
  const c = pick(rng, [...city.roadSet]);
  const along = range(rng, 120, WORLD.size - 120);
  return rng() < 0.5 ? { x: c, y: along } : { x: along, y: c };
}

export function randomSidewalkPoint(rng, city) {
  const b = pick(rng, city.blocks);
  const edge = rangeInt(rng, 0, 3);
  const m = WORLD.sidewalk / 2;
  if (edge === 0) return { x: range(rng, b.x, b.x + b.w), y: b.y - m };
  if (edge === 1) return { x: range(rng, b.x, b.x + b.w), y: b.y + b.h + m };
  if (edge === 2) return { x: b.x - m, y: range(rng, b.y, b.y + b.h) };
  return { x: b.x + b.w + m, y: range(rng, b.y, b.y + b.h) };
}

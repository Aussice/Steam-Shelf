export const CASE = { width: 1.56, height: 2.27, depth: .22 };
export const ROW_PITCH = 2.67;

// All rack depth geometry shares this envelope. `backZ` and `frontZ` are the
// outside faces; cases sit between the rear panel's inside face and the front.
export const RACK = Object.freeze({
  depth: 1.92,
  backZ: -.96,
  frontZ: .96,
  backThickness: .14,
  innerBackZ: -.82,
  shelfThickness: .14,
  shelfTopOffset: .07,
  frontLipDepth: .09,
  frontLipZ: .915,
  labelZ: .962,
  rearRailZ: -.76,
  lightZ: .28,
  wallZ: -1.28,
});

const VALID_PLACEMENTS = new Set(['front', 'spine', 'stack']);
const seeded = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const idKey = game => String(game.appid);

// Matches THREE.Euler's default XYZ order. Keeping the corner math here makes
// the layout itself responsible for shelf support and rack-depth containment.
function rotateCorner({ x, y, z }, rx, ry, rz) {
  const a = Math.cos(rx), b = Math.sin(rx);
  const c = Math.cos(ry), d = Math.sin(ry);
  const e = Math.cos(rz), f = Math.sin(rz);
  return {
    x: c * e * x - c * f * y + d * z,
    y: (a * f + b * e * d) * x + (a * e - b * f * d) * y - b * c * z,
    z: (b * f - a * e * d) * x + (b * e + a * f * d) * y + a * c * z,
  };
}

function localCaseCorners(rx, ry, rz, topOnly = false) {
  const corners = [];
  const ys = topOnly ? [CASE.height / 2] : [-CASE.height / 2, CASE.height / 2];
  for (const x of [-CASE.width / 2, CASE.width / 2]) {
    for (const y of ys) {
      for (const z of [-CASE.depth / 2, CASE.depth / 2]) corners.push(rotateCorner({ x, y, z }, rx, ry, rz));
    }
  }
  return corners;
}

export function caseCorners(entry) {
  return localCaseCorners(entry.rx ?? 0, entry.ry ?? 0, entry.rz ?? 0).map(corner => ({
    x: corner.x + entry.x,
    y: corner.y + entry.y,
    z: corner.z + entry.z,
  }));
}

function supportedY(shelfY, rx, ry, rz) {
  const minY = Math.min(...localCaseCorners(rx, ry, rz).map(corner => corner.y));
  return shelfY + RACK.shelfTopOffset - minY;
}

function containedZ(rx, ry, rz, preferredZ) {
  const corners = localCaseCorners(rx, ry, rz);
  const minZ = Math.min(...corners.map(corner => corner.z));
  const maxZ = Math.max(...corners.map(corner => corner.z));
  return Math.max(RACK.innerBackZ - minZ, Math.min(RACK.frontZ - maxZ, preferredZ));
}

function frontContactZ(rx, ry, rz) {
  const topRearZ = Math.min(...localCaseCorners(rx, ry, rz, true).map(corner => corner.z));
  return RACK.innerBackZ - topRearZ;
}

function automaticTypes(row, rowIndex) {
  if (row.length <= 4) return row.map(() => 'front');
  const frontTarget = Math.min(row.length-2, row.length>=20 ? [7,4,6][rowIndex%3] : Math.max(2,Math.round(row.length*[.34,.23,.4][rowIndex%3])));
  const types = row.map(()=> 'spine');
  for(let i=0;i<frontTarget;i++)types[Math.min(row.length-1,Math.floor((i+.5)*row.length/frontTarget))]='front';

  // Each front-facing game owns one display position. The remaining games form
  // spine-facing groups alongside it, rather than hiding another cover behind it.
  return types;
}

function makeTokens(row, types) {
  const tokens = [];
  for (let index = 0; index < row.length;) {
    if (types[index] === 'stack') {
      const items = [];
      while (index < row.length && types[index] === 'stack' && items.length < 3) items.push({ game: row[index], index: index++ });
      tokens.push({ type: 'stack', items, width: CASE.height + .18 });
      continue;
    }
    const type = types[index];
    tokens.push({ type, items: [{ game: row[index], index }], width: type === 'front' ? CASE.width + .13 : CASE.depth + .05 });
    index++;
  }
  return tokens;
}

// Every unique library entry owns exactly one physical case. Placement overrides are
// applied before slots are measured, so even all-front or all-stack collections fit.
export function arrangeGames(games, rowCount = 3, placements = {}) {
  const unique = [...new Map(games.map(game => [game.appid, game])).values()];
  const preferredRows = rowCount === 4 ? 4 : 3;
  const count = Math.min(preferredRows, Math.max(1, Math.ceil(unique.length / 6)));
  const topShelfY = 2.65 - (4 - count) * ROW_PITCH / 2;
  const rows = Array.from({ length: count }, () => []);
  unique.forEach((game, index) => rows[Math.min(count - 1, Math.floor(index * count / Math.max(unique.length, 1)))].push(game));

  let rackWidth = unique.length < 6 ? Math.max(3.25, unique.length * 1.6) : 9.35;
  const layouts = rows.map((row, rowIndex) => {
    const automatic = automaticTypes(row, rowIndex);
    const types = row.map((game, index) => {
      const override = placements?.[game.appid] ?? placements?.[idKey(game)];
      return VALID_PLACEMENTS.has(override) ? override : automatic[index];
    });
    const tokens = makeTokens(row, types);
    const width = tokens.reduce((sum, token) => sum + token.width, 0);
    rackWidth = Math.max(rackWidth, width + 1.02);
    let cursor = -width / 2;
    const entries = [];

    for (const token of tokens) {
      const x = cursor + token.width / 2;
      cursor += token.width;
      if (token.type === 'stack') {
        token.items.forEach(({ game }, stackIndex) => {
          const seed = Number(game.appid) + rowIndex * 19;
          const rx = -Math.PI / 2;
          const ry = (seeded(seed + 2) - .5) * .025;
          const rz = Math.PI / 2 + (seeded(seed + 4) - .5) * .025;
          const shelfY = topShelfY - rowIndex * ROW_PITCH;
          entries.push({
            game, row: rowIndex, type: 'stack', leaning: false, stackIndex, stackSize: token.items.length,
            x: x + (seeded(seed + 5) - .5) * .055,
            y: supportedY(shelfY, rx, ry, rz) + stackIndex * (CASE.depth + .035),
            z: containedZ(rx, ry, rz, .05 + (seeded(seed + 3) - .5) * .06),
            rx, ry, rz,
          });
        });
        continue;
      }

      const { game } = token.items[0];
      const seed = Number(game.appid) + rowIndex * 19;
      const shelfY = topShelfY - rowIndex * ROW_PITCH;
      const frontLeanSeed = seeded(seed + 6);
      // Most covers retain the original near-front, almost-upright display.
      // The remaining deterministic minority genuinely rests against the back.
      const leaning = token.type === 'front' && frontLeanSeed >= .60;
      const lean = leaning
        ? .25 + (frontLeanSeed - .60) / .40 * .24
        : .035 + Math.min(frontLeanSeed / .60, 1) * .055;
      const rx = token.type === 'front' ? -lean : -.012;
      const ry = token.type === 'front' ? (seeded(seed + 1) - .5) * .07 : Math.PI / 2 + (seeded(seed + 2) - .5) * .075;
      const rz = (seeded(seed + 4) - .5) * (token.type === 'front' ? .055 : .026);
      const y = supportedY(shelfY, rx, ry, rz);
      const entry = {
        game, row: rowIndex, type: token.type, leaning, x, y,
        z: token.type === 'front'
          ? leaning
            ? frontContactZ(rx, ry, rz)
            : containedZ(rx, ry, rz, RACK.frontZ - .20 - seeded(seed) * .10)
          : containedZ(rx, ry, rz, .05 + (seeded(seed + 3) - .5) * .08),
        rx, ry, rz,
      };
      entries.push(entry);
    }

    return entries;
  });

  return {
    width: rackWidth,
    entries: layouts.flat(),
    rows: count,
    shelfYs: rows.map((_, index) => topShelfY - index * ROW_PITCH),
    bounds: {
      top: 5.43 - (4 - count) * ROW_PITCH / 2,
      bottom: -5.68 + (4 - count) * ROW_PITCH / 2,
      height: 11.10 - (4 - count) * ROW_PITCH,
    },
  };
}

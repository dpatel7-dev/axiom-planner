// ==========================================================
// AXIOM CUBE — Procedural Three.js geometric logo system
// 42 unique cube compositions, deterministic by index.
// ==========================================================

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Color palette — matches the orange/dark grey from the original logo sheet
const COLORS = {
  orange: 0xf0945a,
  orangeBright: 0xffa86a,
  orangeDeep: 0xc06a3a,
  dark: 0x2a2a2a,
  darkLight: 0x404040,
  darkDeep: 0x1a1a1a,
};

// ==========================================================
// 42 cube recipes — each describes how to compose the logo
// Each recipe is an array of "parts", each part is a primitive
// with position, scale, color, and optional features (hole, frame).
// ==========================================================

const RECIPES = [
  // 0: classic stacked slabs (3 horizontal layers)
  [
    { type: 'slab', pos: [0, -0.55, 0], scale: [1.6, 0.3, 1.6], color: 'dark' },
    { type: 'slab', pos: [0, 0,    0], scale: [1.6, 0.3, 1.6], color: 'orange' },
    { type: 'slab', pos: [0, 0.55, 0], scale: [1.6, 0.3, 1.6], color: 'dark' },
  ],
  // 1: dark cube with orange window cube inside (inset)
  [
    { type: 'frame', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube',  pos: [0, 0, 0], scale: [0.8, 0.8, 0.8], color: 'orange' },
  ],
  // 2: vertical stripes — alternating
  [
    { type: 'cube', pos: [-0.55, 0, 0], scale: [0.4, 1.6, 1.6], color: 'orange' },
    { type: 'cube', pos: [-0.15, 0, 0], scale: [0.4, 1.6, 1.6], color: 'dark' },
    { type: 'cube', pos: [ 0.25, 0, 0], scale: [0.4, 1.6, 1.6], color: 'orange' },
    { type: 'cube', pos: [ 0.65, 0, 0], scale: [0.4, 1.6, 1.6], color: 'dark' },
  ],
  // 3: dark cube with orange window cut into front face
  [
    { type: 'cube',   pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube',   pos: [0, 0, 0.85], scale: [1.0, 1.0, 0.05], color: 'orange' },
  ],
  // 4: pillars — 3 standing rectangles
  [
    { type: 'cube', pos: [-0.5, 0, 0], scale: [0.3, 1.6, 0.5], color: 'dark' },
    { type: 'cube', pos: [ 0,   0, 0], scale: [0.3, 1.6, 0.5], color: 'orange' },
    { type: 'cube', pos: [ 0.5, 0, 0], scale: [0.3, 1.6, 0.5], color: 'dark' },
  ],
  // 5: nested frames
  [
    { type: 'frame', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'frame', pos: [0, 0, 0], scale: [1.0, 1.0, 1.0], color: 'orange' },
  ],
  // 6: corner accent — orange cube in upper-right corner of dark cube
  [
    { type: 'cube', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube', pos: [0.55, 0.55, 0.55], scale: [0.5, 0.5, 0.5], color: 'orange' },
  ],
  // 7: 4-corner voxel cluster
  [
    { type: 'cube', pos: [-0.4, -0.4, -0.4], scale: [0.55, 0.55, 0.55], color: 'orange' },
    { type: 'cube', pos: [ 0.4,  0.4, -0.4], scale: [0.55, 0.55, 0.55], color: 'orange' },
    { type: 'cube', pos: [-0.4,  0.4,  0.4], scale: [0.55, 0.55, 0.55], color: 'dark' },
    { type: 'cube', pos: [ 0.4, -0.4,  0.4], scale: [0.55, 0.55, 0.55], color: 'dark' },
  ],
  // 8: pierced cube (hole through middle)
  [
    { type: 'pierced', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark', holeSize: 0.5, holeColor: 'orange' },
  ],
  // 9: ladder — horizontal bars
  [
    { type: 'cube', pos: [0, -0.6, 0], scale: [1.6, 0.18, 1.6], color: 'orange' },
    { type: 'cube', pos: [0, -0.2, 0], scale: [1.6, 0.18, 1.6], color: 'orange' },
    { type: 'cube', pos: [0,  0.2, 0], scale: [1.6, 0.18, 1.6], color: 'orange' },
    { type: 'cube', pos: [0,  0.6, 0], scale: [1.6, 0.18, 1.6], color: 'orange' },
  ],
  // 10: T-shape
  [
    { type: 'cube', pos: [0, 0.4, 0], scale: [1.6, 0.4, 1.6], color: 'orange' },
    { type: 'cube', pos: [0, -0.2, 0], scale: [0.5, 0.8, 1.6], color: 'dark' },
  ],
  // 11: split cube — top orange, bottom dark
  [
    { type: 'cube', pos: [0, 0.4, 0], scale: [1.6, 0.8, 1.6], color: 'orange' },
    { type: 'cube', pos: [0, -0.4, 0], scale: [1.6, 0.8, 1.6], color: 'dark' },
  ],
  // 12: tower — 4 small cubes stacked
  [
    { type: 'cube', pos: [0, -0.6, 0], scale: [0.7, 0.35, 0.7], color: 'orange' },
    { type: 'cube', pos: [0, -0.2, 0], scale: [0.7, 0.35, 0.7], color: 'dark' },
    { type: 'cube', pos: [0,  0.2, 0], scale: [0.7, 0.35, 0.7], color: 'orange' },
    { type: 'cube', pos: [0,  0.6, 0], scale: [0.7, 0.35, 0.7], color: 'dark' },
  ],
  // 13: open box — frame cube with bottom plate
  [
    { type: 'frame', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube',  pos: [0, -0.7, 0], scale: [1.4, 0.2, 1.4], color: 'orange' },
  ],
  // 14: face cube with 2 dot voxels (eyes)
  [
    { type: 'cube', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube', pos: [-0.3, 0.2, 0.85], scale: [0.25, 0.25, 0.05], color: 'orange' },
    { type: 'cube', pos: [ 0.3, 0.2, 0.85], scale: [0.25, 0.25, 0.05], color: 'orange' },
  ],
  // 15: maze pattern — frame with internal cross
  [
    { type: 'frame', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube',  pos: [0, 0, 0], scale: [0.3, 1.0, 1.0], color: 'orange' },
    { type: 'cube',  pos: [0, 0, 0], scale: [1.0, 0.3, 1.0], color: 'orange' },
  ],
  // 16: dot in cube — single voxel centered
  [
    { type: 'frame', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube',  pos: [0, 0, 0], scale: [0.4, 0.4, 0.4], color: 'orange' },
  ],
  // 17: stairs — diagonal stack
  [
    { type: 'cube', pos: [-0.4, -0.4, 0], scale: [0.6, 0.4, 1.4], color: 'dark' },
    { type: 'cube', pos: [0,    0,    0], scale: [0.6, 0.4, 1.4], color: 'orange' },
    { type: 'cube', pos: [ 0.4, 0.4,  0], scale: [0.6, 0.4, 1.4], color: 'dark' },
  ],
  // 18: 9-grid (3x3 small cubes, alternating)
  [
    ...gridRecipe(3, 3, 0.45, ['orange', 'dark']),
  ],
  // 19: bookend — vertical bars on sides with horizontal between
  [
    { type: 'cube', pos: [-0.65, 0, 0], scale: [0.3, 1.6, 1.0], color: 'dark' },
    { type: 'cube', pos: [ 0.65, 0, 0], scale: [0.3, 1.6, 1.0], color: 'dark' },
    { type: 'cube', pos: [ 0, 0, 0], scale: [0.8, 0.4, 1.0], color: 'orange' },
  ],
  // 20: punched square — orange bg, dark hole
  [
    { type: 'cube', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'orange' },
    { type: 'cube', pos: [0, 0, 0.8], scale: [0.7, 0.7, 0.05], color: 'dark' },
  ],
  // 21: ridges — vertical bars all orange
  [
    { type: 'cube', pos: [-0.55, 0, 0], scale: [0.25, 1.6, 1.6], color: 'orange' },
    { type: 'cube', pos: [-0.15, 0, 0], scale: [0.25, 1.6, 1.6], color: 'orange' },
    { type: 'cube', pos: [ 0.25, 0, 0], scale: [0.25, 1.6, 1.6], color: 'orange' },
    { type: 'cube', pos: [ 0.65, 0, 0], scale: [0.25, 1.6, 1.6], color: 'orange' },
  ],
  // 22: floating cube above slab
  [
    { type: 'cube', pos: [0, -0.45, 0], scale: [1.6, 0.3, 1.6], color: 'dark' },
    { type: 'cube', pos: [0, 0.3,  0], scale: [0.8, 0.8, 0.8], color: 'orange' },
  ],
  // 23: U-shape (open top)
  [
    { type: 'cube', pos: [-0.55, 0, 0], scale: [0.4, 1.6, 1.0], color: 'dark' },
    { type: 'cube', pos: [ 0.55, 0, 0], scale: [0.4, 1.6, 1.0], color: 'dark' },
    { type: 'cube', pos: [ 0, -0.6, 0], scale: [1.5, 0.4, 1.0], color: 'orange' },
  ],
  // 24: half-and-half — left orange / right dark
  [
    { type: 'cube', pos: [-0.4, 0, 0], scale: [0.8, 1.6, 1.6], color: 'orange' },
    { type: 'cube', pos: [ 0.4, 0, 0], scale: [0.8, 1.6, 1.6], color: 'dark' },
  ],
  // 25: arrow up — triangle composed of cubes
  [
    { type: 'cube', pos: [0,    0.4, 0], scale: [0.4, 0.4, 0.6], color: 'orange' },
    { type: 'cube', pos: [-0.3, 0,   0], scale: [0.4, 0.4, 0.6], color: 'orange' },
    { type: 'cube', pos: [ 0.3, 0,   0], scale: [0.4, 0.4, 0.6], color: 'orange' },
    { type: 'cube', pos: [-0.6, -0.4, 0], scale: [0.4, 0.4, 0.6], color: 'dark' },
    { type: 'cube', pos: [ 0,   -0.4, 0], scale: [0.4, 0.4, 0.6], color: 'dark' },
    { type: 'cube', pos: [ 0.6, -0.4, 0], scale: [0.4, 0.4, 0.6], color: 'dark' },
  ],
  // 26: deep pierced — channel through Z axis
  [
    { type: 'cube',  pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube',  pos: [0, 0, 0], scale: [0.6, 0.6, 1.7], color: 'orange' },
  ],
  // 27: floor + cube on top
  [
    { type: 'cube', pos: [0, -0.55, 0], scale: [1.6, 0.3, 1.6], color: 'orange' },
    { type: 'cube', pos: [0,  0.15, 0], scale: [0.8, 0.8, 0.8], color: 'dark' },
  ],
  // 28: tic-tac-toe (3x3 frames + center cube)
  [
    ...gridRecipe(3, 3, 0.45, ['dark', 'dark', 'dark', 'dark', 'orange', 'dark', 'dark', 'dark', 'dark']),
  ],
  // 29: split-stripe horizontal
  [
    { type: 'cube', pos: [0,  0.5, 0], scale: [1.6, 0.4, 1.6], color: 'dark' },
    { type: 'cube', pos: [0,  0,   0], scale: [1.6, 0.4, 1.6], color: 'orange' },
    { type: 'cube', pos: [0, -0.5, 0], scale: [1.6, 0.4, 1.6], color: 'dark' },
  ],
  // 30: cluster of 6 small voxels
  [
    { type: 'cube', pos: [-0.4, 0.3, 0], scale: [0.4, 0.4, 0.4], color: 'orange' },
    { type: 'cube', pos: [ 0,   0.3, 0], scale: [0.4, 0.4, 0.4], color: 'dark' },
    { type: 'cube', pos: [ 0.4, 0.3, 0], scale: [0.4, 0.4, 0.4], color: 'orange' },
    { type: 'cube', pos: [-0.4, -0.3, 0], scale: [0.4, 0.4, 0.4], color: 'dark' },
    { type: 'cube', pos: [ 0,   -0.3, 0], scale: [0.4, 0.4, 0.4], color: 'orange' },
    { type: 'cube', pos: [ 0.4, -0.3, 0], scale: [0.4, 0.4, 0.4], color: 'dark' },
  ],
  // 31: portal — frame with floating square inside
  [
    { type: 'frame', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'orange' },
    { type: 'cube',  pos: [0, 0, 0], scale: [0.7, 0.7, 0.05], color: 'orange' },
  ],
  // 32: split horizontal — orange top
  [
    { type: 'cube', pos: [0, 0.3, 0], scale: [1.6, 1.0, 1.6], color: 'orange' },
    { type: 'cube', pos: [0, -0.55, 0], scale: [1.6, 0.3, 1.6], color: 'dark' },
  ],
  // 33: pixel scatter (random small cubes around frame)
  [
    { type: 'frame', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube', pos: [-0.3, -0.3, 0], scale: [0.2, 0.2, 0.2], color: 'orange' },
    { type: 'cube', pos: [ 0.3,  0.3, 0], scale: [0.2, 0.2, 0.2], color: 'orange' },
    { type: 'cube', pos: [ 0.3, -0.3, 0], scale: [0.2, 0.2, 0.2], color: 'orange' },
    { type: 'cube', pos: [-0.3,  0.3, 0], scale: [0.2, 0.2, 0.2], color: 'orange' },
    { type: 'cube', pos: [ 0,    0,   0], scale: [0.3, 0.3, 0.3], color: 'orange' },
  ],
  // 34: bookcase — vertical bar with horizontal shelves
  [
    { type: 'cube', pos: [-0.55, 0, 0], scale: [0.3, 1.6, 1.0], color: 'dark' },
    { type: 'cube', pos: [ 0,    0.5,  0], scale: [0.8, 0.18, 1.0], color: 'orange' },
    { type: 'cube', pos: [ 0,    0,    0], scale: [0.8, 0.18, 1.0], color: 'orange' },
    { type: 'cube', pos: [ 0,   -0.5,  0], scale: [0.8, 0.18, 1.0], color: 'orange' },
  ],
  // 35: frame with window cube floating front
  [
    { type: 'frame', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube',  pos: [0, 0, 0.6], scale: [0.6, 0.6, 0.4], color: 'orange' },
  ],
  // 36: zig-zag — diagonal slabs
  [
    { type: 'cube', pos: [0, -0.55, 0], scale: [1.6, 0.25, 1.6], color: 'orange' },
    { type: 'cube', pos: [0, -0.1,  0], scale: [1.6, 0.25, 0.7], color: 'dark' },
    { type: 'cube', pos: [0,  0.35, 0], scale: [0.7, 0.25, 1.6], color: 'orange' },
    { type: 'cube', pos: [0,  0.7,  0], scale: [1.6, 0.25, 1.6], color: 'dark' },
  ],
  // 37: orange cube with dark dot center
  [
    { type: 'cube', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'orange' },
    { type: 'cube', pos: [0, 0, 0], scale: [0.5, 0.5, 0.5], color: 'dark' },
  ],
  // 38: levitating slabs
  [
    { type: 'cube', pos: [0, -0.6, 0], scale: [1.6, 0.2, 1.6], color: 'dark' },
    { type: 'cube', pos: [0,  0.6, 0], scale: [1.6, 0.2, 1.6], color: 'orange' },
  ],
  // 39: big H shape
  [
    { type: 'cube', pos: [-0.55, 0, 0], scale: [0.4, 1.6, 1.0], color: 'orange' },
    { type: 'cube', pos: [ 0.55, 0, 0], scale: [0.4, 1.6, 1.0], color: 'orange' },
    { type: 'cube', pos: [ 0,    0, 0], scale: [0.6, 0.4, 1.0], color: 'dark' },
  ],
  // 40: classic cube (just a solid orange cube — clean fallback)
  [
    { type: 'cube', pos: [0, 0, 0], scale: [1.5, 1.5, 1.5], color: 'orange' },
  ],
  // 41: spiral steps (pinwheel of 4 small cubes around center)
  [
    { type: 'cube', pos: [0, 0, 0], scale: [0.5, 0.5, 0.5], color: 'orange' },
    { type: 'cube', pos: [-0.55, 0.4, 0], scale: [0.4, 0.4, 0.4], color: 'dark' },
    { type: 'cube', pos: [ 0.55, 0.4, 0], scale: [0.4, 0.4, 0.4], color: 'dark' },
    { type: 'cube', pos: [-0.55, -0.4, 0], scale: [0.4, 0.4, 0.4], color: 'dark' },
    { type: 'cube', pos: [ 0.55, -0.4, 0], scale: [0.4, 0.4, 0.4], color: 'dark' },
  ],
];

function gridRecipe(cols, rows, size, colors) {
  const arr = [];
  const start = -((cols - 1) * size) / 2;
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const color = Array.isArray(colors) && colors.length > 2 ? colors[i % colors.length] : (i % 2 === 0 ? 'orange' : 'dark');
      arr.push({ type: 'cube', pos: [start + c * size, start + r * size, 0], scale: [size * 0.85, size * 0.85, size * 0.85], color });
      i++;
    }
  }
  return arr;
}

// ==========================================================
// Build a single Three.js mesh group from a recipe.
// ==========================================================
function buildLogoMesh(recipeIdx, accentColor = null) {
  const recipe = RECIPES[recipeIdx % RECIPES.length];
  const group = new THREE.Group();

  const orangeHex = accentColor !== null ? accentColor : COLORS.orange;
  const orangeBrightHex = accentColor !== null ? lighten(orangeHex, 0.15) : COLORS.orangeBright;

  for (const part of recipe) {
    const colorHex =
      part.color === 'orange' ? orangeHex :
      part.color === 'orangeBright' ? orangeBrightHex :
      part.color === 'dark' ? COLORS.dark :
      part.color === 'darkLight' ? COLORS.darkLight :
      COLORS.darkDeep;

    if (part.type === 'cube') {
      const geo = new THREE.BoxGeometry(part.scale[0], part.scale[1], part.scale[2]);
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.45,
        metalness: 0.15,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(part.pos[0], part.pos[1], part.pos[2]);
      group.add(mesh);

      // Add black edges to give the geometric logo crisp definition
      const edges = new THREE.EdgesGeometry(geo);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
      const line = new THREE.LineSegments(edges, lineMat);
      line.position.set(part.pos[0], part.pos[1], part.pos[2]);
      group.add(line);
    } else if (part.type === 'slab') {
      const geo = new THREE.BoxGeometry(part.scale[0], part.scale[1], part.scale[2]);
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.45,
        metalness: 0.15,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(part.pos[0], part.pos[1], part.pos[2]);
      group.add(mesh);
      const edges = new THREE.EdgesGeometry(geo);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
      const line = new THREE.LineSegments(edges, lineMat);
      line.position.set(part.pos[0], part.pos[1], part.pos[2]);
      group.add(line);
    } else if (part.type === 'frame') {
      // Hollow cube — 12 thin edge bars
      const s = part.scale[0] / 2;
      const t = 0.12; // edge thickness
      const positions = [
        // bottom 4
        { p: [0, -s, -s], scale: [part.scale[0], t, t] },
        { p: [0, -s,  s], scale: [part.scale[0], t, t] },
        { p: [-s, -s, 0], scale: [t, t, part.scale[2]] },
        { p: [ s, -s, 0], scale: [t, t, part.scale[2]] },
        // top 4
        { p: [0,  s, -s], scale: [part.scale[0], t, t] },
        { p: [0,  s,  s], scale: [part.scale[0], t, t] },
        { p: [-s,  s, 0], scale: [t, t, part.scale[2]] },
        { p: [ s,  s, 0], scale: [t, t, part.scale[2]] },
        // 4 verticals
        { p: [-s, 0, -s], scale: [t, part.scale[1], t] },
        { p: [ s, 0, -s], scale: [t, part.scale[1], t] },
        { p: [-s, 0,  s], scale: [t, part.scale[1], t] },
        { p: [ s, 0,  s], scale: [t, part.scale[1], t] },
      ];
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.5,
        metalness: 0.2,
      });
      for (const edge of positions) {
        const geo = new THREE.BoxGeometry(edge.scale[0], edge.scale[1], edge.scale[2]);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(part.pos[0] + edge.p[0], part.pos[1] + edge.p[1], part.pos[2] + edge.p[2]);
        group.add(mesh);
      }
    } else if (part.type === 'pierced') {
      // Cube with a square hole through Z axis
      const w = part.scale[0];
      const h = part.scale[1];
      const d = part.scale[2];
      const hs = part.holeSize || 0.5;
      // Build the pierced cube as 4 boxes around the hole
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.5,
        metalness: 0.15,
      });
      const margin = (w - hs) / 2;
      const sides = [
        { p: [-(hs / 2 + margin / 2), 0, 0], scale: [margin, h, d] },
        { p: [ (hs / 2 + margin / 2), 0, 0], scale: [margin, h, d] },
        { p: [0, -(hs / 2 + margin / 2), 0], scale: [hs, margin, d] },
        { p: [0,  (hs / 2 + margin / 2), 0], scale: [hs, margin, d] },
      ];
      for (const side of sides) {
        const geo = new THREE.BoxGeometry(side.scale[0], side.scale[1], side.scale[2]);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(part.pos[0] + side.p[0], part.pos[1] + side.p[1], part.pos[2] + side.p[2]);
        group.add(mesh);
        const edges = new THREE.EdgesGeometry(geo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
        const line = new THREE.LineSegments(edges, lineMat);
        line.position.copy(mesh.position);
        group.add(line);
      }
      // Optional inner hole color
      if (part.holeColor) {
        const innerColorHex = part.holeColor === 'orange' ? orangeHex : COLORS.dark;
        const geo = new THREE.BoxGeometry(hs * 0.9, hs * 0.9, d * 0.5);
        const innerMat = new THREE.MeshStandardMaterial({
          color: innerColorHex,
          roughness: 0.4,
          metalness: 0.2,
          emissive: innerColorHex,
          emissiveIntensity: 0.15,
        });
        const inner = new THREE.Mesh(geo, innerMat);
        inner.position.set(part.pos[0], part.pos[1], part.pos[2]);
        group.add(inner);
      }
    }
  }

  return group;
}

function lighten(hex, amount) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(g + (255 - g) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return (lr << 16) | (lg << 8) | lb;
}

// ==========================================================
// AxiomCube — public class for rendering a single cube logo
// in a given <canvas> or <div> element.
// ==========================================================
export class AxiomCube {
  constructor(container, options = {}) {
    this.container = container;
    this.size = options.size || 64;
    this.idx = options.idx ?? 0;
    this.autoRotate = options.autoRotate !== false;
    this.rotateSpeed = options.rotateSpeed || 0.005;
    this.transparent = options.transparent !== false;
    this.accentColor = options.accentColor ?? null;

    // Set up renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.size, this.size);
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();

    // Camera — isometric-ish angle
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(2.8, 2.2, 2.8);
    this.camera.lookAt(0, 0, 0);

    // Lighting — warm key + cool fill, matches dawn aesthetic
    const keyLight = new THREE.DirectionalLight(0xffd9b0, 1.2);
    keyLight.position.set(3, 4, 2);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xb0c0d8, 0.5);
    fillLight.position.set(-3, -1, -2);
    this.scene.add(fillLight);

    const ambient = new THREE.AmbientLight(0x9090a0, 0.4);
    this.scene.add(ambient);

    // Soft top rim light
    const rim = new THREE.DirectionalLight(0xffa86a, 0.4);
    rim.position.set(0, 5, -5);
    this.scene.add(rim);

    // Build the logo
    this.buildLogo(this.idx);

    // Animation loop
    this.start();
  }

  buildLogo(idx) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.disposeMesh(this.mesh);
    }
    this.idx = idx;
    this.mesh = buildLogoMesh(idx, this.accentColor);
    // Slight initial rotation so we see 3D-ness immediately
    this.mesh.rotation.x = -0.15;
    this.mesh.rotation.y = -0.6;
    this.scene.add(this.mesh);
  }

  setIdx(idx, animated = true) {
    if (animated) {
      this.flipTo(idx);
    } else {
      this.buildLogo(idx);
    }
  }

  // Smooth flip animation when changing logo idx
  flipTo(newIdx) {
    if (this.flipping) return;
    this.flipping = true;
    const start = performance.now();
    const duration = 700;
    const startRot = this.mesh.rotation.y;
    const swapAt = duration / 2;
    let swapped = false;

    const animate = (now) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // ease-in-out
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.mesh.rotation.y = startRot + Math.PI * eased;
      // Swap mesh content at midpoint when it's edge-on (invisible)
      if (!swapped && elapsed >= swapAt) {
        swapped = true;
        const swappedMesh = buildLogoMesh(newIdx, this.accentColor);
        // Preserve current rotation
        const oldY = this.mesh.rotation.y;
        const oldX = this.mesh.rotation.x;
        this.scene.remove(this.mesh);
        this.disposeMesh(this.mesh);
        this.mesh = swappedMesh;
        this.mesh.rotation.x = oldX;
        this.mesh.rotation.y = oldY;
        this.scene.add(this.mesh);
      }
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.idx = newIdx;
        this.flipping = false;
      }
    };
    requestAnimationFrame(animate);
  }

  setAccentColor(hex) {
    this.accentColor = hex;
    this.buildLogo(this.idx);
  }

  start() {
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 16.6;
      last = now;
      if (this.autoRotate && this.mesh && !this.flipping) {
        this.mesh.rotation.y += this.rotateSpeed * dt;
      }
      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  resize(size) {
    this.size = size;
    this.renderer.setSize(size, size);
  }

  disposeMesh(mesh) {
    mesh.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  destroy() {
    this.stop();
    if (this.mesh) this.disposeMesh(this.mesh);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

// ==========================================================
// Geometric background scene — drifting wireframes + particles
// ==========================================================
export class GeometricBackground {
  constructor(container, options = {}) {
    this.container = container;
    this.accentColor = options.accentColor ?? COLORS.orange;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 0, 18);

    // Ambient light is enough — we only have wireframes and emissive points
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    this.shapes = [];
    this.particles = null;
    this.spawnShapes(8);
    this.spawnParticles(120);

    window.addEventListener('resize', () => this.handleResize());
    this.start();
  }

  spawnShapes(count) {
    const geometries = [
      () => new THREE.BoxGeometry(1.2, 1.2, 1.2),
      () => new THREE.OctahedronGeometry(0.9, 0),
      () => new THREE.TetrahedronGeometry(1.0, 0),
      () => new THREE.IcosahedronGeometry(0.85, 0),
      () => new THREE.DodecahedronGeometry(0.85, 0),
    ];

    for (let i = 0; i < count; i++) {
      const geo = geometries[i % geometries.length]();
      const edges = new THREE.EdgesGeometry(geo);
      const mat = new THREE.LineBasicMaterial({
        color: i % 3 === 0 ? this.accentColor : 0xb8c9e0,
        transparent: true,
        opacity: 0.18,
      });
      const wireframe = new THREE.LineSegments(edges, mat);

      // Spread across viewport with depth
      wireframe.position.set(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 14 - 4
      );
      const scale = 0.7 + Math.random() * 1.4;
      wireframe.scale.set(scale, scale, scale);

      // Per-shape animation params
      wireframe.userData = {
        rotSpeed: {
          x: (Math.random() - 0.5) * 0.003,
          y: (Math.random() - 0.5) * 0.003,
          z: (Math.random() - 0.5) * 0.003,
        },
        driftSpeed: {
          x: (Math.random() - 0.5) * 0.005,
          y: (Math.random() - 0.5) * 0.003,
        },
        startY: wireframe.position.y,
        bobAmount: 0.5 + Math.random() * 0.8,
        bobPhase: Math.random() * Math.PI * 2,
      };

      this.scene.add(wireframe);
      this.shapes.push(wireframe);
    }
  }

  spawnParticles(count) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const accentColor = new THREE.Color(this.accentColor);
    const coolColor = new THREE.Color(0xb8c9e0);

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 25;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 18 - 4;

      const useAccent = Math.random() > 0.6;
      const c = useAccent ? accentColor : coolColor;
      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      sizes[i] = 0.06 + Math.random() * 0.12;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom shader for soft, glowing geometric points
    const material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float time;
        void main() {
          vColor = color;
          vec3 pos = position;
          // Subtle wave motion
          pos.y += sin(time * 0.5 + position.x * 0.3) * 0.15;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          // Round, soft point with slight glow
          vec2 c = gl_PointCoord - vec2(0.5);
          float dist = length(c);
          if (dist > 0.5) discard;
          float alpha = smoothstep(0.5, 0.15, dist) * 0.7;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  setAccentColor(hex) {
    this.accentColor = hex;
    // Update wireframe colors
    this.shapes.forEach((s, i) => {
      if (i % 3 === 0) s.material.color.setHex(hex);
    });
    // Update particle colors
    if (this.particles) {
      const colors = this.particles.geometry.attributes.color.array;
      const accentColor = new THREE.Color(hex);
      const coolColor = new THREE.Color(0xb8c9e0);
      const count = colors.length / 3;
      for (let i = 0; i < count; i++) {
        const useAccent = (i * 31337) % 5 < 2; // deterministic-ish
        const c = useAccent ? accentColor : coolColor;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      this.particles.geometry.attributes.color.needsUpdate = true;
    }
  }

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  start() {
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 16.6;
      last = now;
      const time = now / 1000;

      // Rotate and drift wireframes
      this.shapes.forEach(s => {
        const ud = s.userData;
        s.rotation.x += ud.rotSpeed.x * dt;
        s.rotation.y += ud.rotSpeed.y * dt;
        s.rotation.z += ud.rotSpeed.z * dt;
        s.position.x += ud.driftSpeed.x * dt;
        s.position.y = ud.startY + Math.sin(time + ud.bobPhase) * ud.bobAmount * 0.4;
        // Wrap
        if (s.position.x > 18) s.position.x = -18;
        if (s.position.x < -18) s.position.x = 18;
      });

      // Update particle shader time
      if (this.particles) {
        this.particles.material.uniforms.time.value = time;
        this.particles.rotation.y = time * 0.02;
      }

      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
  }
}

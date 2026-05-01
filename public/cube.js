/*!
 * Axiom Planner — cube.js
 * Copyright (c) 2026 Dhruv Patel. All Rights Reserved.
 * See LICENSE for terms. Unauthorized reuse prohibited.
 */

// ==========================================================
// AXIOM CUBE — Procedural Three.js geometric logos
// 42 unique cube compositions, rendered as STATIC 3D models.
// No spinning. One live renderer for the brand mark, snapshots elsewhere.
// ==========================================================

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const COLORS = {
  orange: 0xf0945a,
  orangeBright: 0xffa86a,
  orangeDeep: 0xc06a3a,
  dark: 0x2a2a2a,
  darkLight: 0x404040,
  darkDeep: 0x1a1a1a,
};

// ==========================================================
// 42 cube recipes
// ==========================================================
const RECIPES = [
  // 0: classic stacked slabs
  [
    { type: 'cube', pos: [0, -0.55, 0], scale: [1.6, 0.3, 1.6], color: 'dark' },
    { type: 'cube', pos: [0, 0,    0], scale: [1.6, 0.3, 1.6], color: 'orange' },
    { type: 'cube', pos: [0, 0.55, 0], scale: [1.6, 0.3, 1.6], color: 'dark' },
  ],
  // 1: dark frame with orange cube inside
  [
    { type: 'frame', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube',  pos: [0, 0, 0], scale: [0.8, 0.8, 0.8], color: 'orange' },
  ],
  // 2: vertical stripes
  [
    { type: 'cube', pos: [-0.55, 0, 0], scale: [0.4, 1.6, 1.6], color: 'orange' },
    { type: 'cube', pos: [-0.15, 0, 0], scale: [0.4, 1.6, 1.6], color: 'dark' },
    { type: 'cube', pos: [ 0.25, 0, 0], scale: [0.4, 1.6, 1.6], color: 'orange' },
    { type: 'cube', pos: [ 0.65, 0, 0], scale: [0.4, 1.6, 1.6], color: 'dark' },
  ],
  // 3: dark cube with orange face window
  [
    { type: 'cube', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube', pos: [0, 0, 0.83], scale: [1.0, 1.0, 0.05], color: 'orange' },
  ],
  // 4: 3 pillars
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
  // 6: corner accent
  [
    { type: 'cube', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube', pos: [0.55, 0.55, 0.55], scale: [0.5, 0.5, 0.5], color: 'orange' },
  ],
  // 7: 4 corner voxels
  [
    { type: 'cube', pos: [-0.4, -0.4, -0.4], scale: [0.55, 0.55, 0.55], color: 'orange' },
    { type: 'cube', pos: [ 0.4,  0.4, -0.4], scale: [0.55, 0.55, 0.55], color: 'orange' },
    { type: 'cube', pos: [-0.4,  0.4,  0.4], scale: [0.55, 0.55, 0.55], color: 'dark' },
    { type: 'cube', pos: [ 0.4, -0.4,  0.4], scale: [0.55, 0.55, 0.55], color: 'dark' },
  ],
  // 8: pierced cube
  [
    { type: 'pierced', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark', holeSize: 0.5, holeColor: 'orange' },
  ],
  // 9: ladder bars
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
  // 11: split horizontal
  [
    { type: 'cube', pos: [0, 0.4, 0], scale: [1.6, 0.8, 1.6], color: 'orange' },
    { type: 'cube', pos: [0, -0.4, 0], scale: [1.6, 0.8, 1.6], color: 'dark' },
  ],
  // 12: tower of 4
  [
    { type: 'cube', pos: [0, -0.6, 0], scale: [0.7, 0.35, 0.7], color: 'orange' },
    { type: 'cube', pos: [0, -0.2, 0], scale: [0.7, 0.35, 0.7], color: 'dark' },
    { type: 'cube', pos: [0,  0.2, 0], scale: [0.7, 0.35, 0.7], color: 'orange' },
    { type: 'cube', pos: [0,  0.6, 0], scale: [0.7, 0.35, 0.7], color: 'dark' },
  ],
  // 13: open box
  [
    { type: 'frame', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube',  pos: [0, -0.7, 0], scale: [1.4, 0.2, 1.4], color: 'orange' },
  ],
  // 14: face cube
  [
    { type: 'cube', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube', pos: [-0.3, 0.2, 0.83], scale: [0.25, 0.25, 0.05], color: 'orange' },
    { type: 'cube', pos: [ 0.3, 0.2, 0.83], scale: [0.25, 0.25, 0.05], color: 'orange' },
  ],
  // 15: maze
  [
    { type: 'frame', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube',  pos: [0, 0, 0], scale: [0.3, 1.0, 1.0], color: 'orange' },
    { type: 'cube',  pos: [0, 0, 0], scale: [1.0, 0.3, 1.0], color: 'orange' },
  ],
  // 16: dot in cube
  [
    { type: 'frame', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube',  pos: [0, 0, 0], scale: [0.4, 0.4, 0.4], color: 'orange' },
  ],
  // 17: stairs
  [
    { type: 'cube', pos: [-0.4, -0.4, 0], scale: [0.6, 0.4, 1.4], color: 'dark' },
    { type: 'cube', pos: [0,    0,    0], scale: [0.6, 0.4, 1.4], color: 'orange' },
    { type: 'cube', pos: [ 0.4, 0.4,  0], scale: [0.6, 0.4, 1.4], color: 'dark' },
  ],
  // 18: 9-grid
  [
    ...gridRecipe(3, 3, 0.45, 'alternating'),
  ],
  // 19: bookend
  [
    { type: 'cube', pos: [-0.65, 0, 0], scale: [0.3, 1.6, 1.0], color: 'dark' },
    { type: 'cube', pos: [ 0.65, 0, 0], scale: [0.3, 1.6, 1.0], color: 'dark' },
    { type: 'cube', pos: [ 0,    0, 0], scale: [0.8, 0.4, 1.0], color: 'orange' },
  ],
  // 20: punched orange
  [
    { type: 'cube', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'orange' },
    { type: 'cube', pos: [0, 0, 0.83], scale: [0.7, 0.7, 0.05], color: 'dark' },
  ],
  // 21: all-orange ridges
  [
    { type: 'cube', pos: [-0.55, 0, 0], scale: [0.25, 1.6, 1.6], color: 'orange' },
    { type: 'cube', pos: [-0.15, 0, 0], scale: [0.25, 1.6, 1.6], color: 'orange' },
    { type: 'cube', pos: [ 0.25, 0, 0], scale: [0.25, 1.6, 1.6], color: 'orange' },
    { type: 'cube', pos: [ 0.65, 0, 0], scale: [0.25, 1.6, 1.6], color: 'orange' },
  ],
  // 22: floating cube above slab
  [
    { type: 'cube', pos: [0, -0.45, 0], scale: [1.6, 0.3, 1.6], color: 'dark' },
    { type: 'cube', pos: [0,  0.3, 0], scale: [0.8, 0.8, 0.8], color: 'orange' },
  ],
  // 23: U-shape
  [
    { type: 'cube', pos: [-0.55, 0, 0], scale: [0.4, 1.6, 1.0], color: 'dark' },
    { type: 'cube', pos: [ 0.55, 0, 0], scale: [0.4, 1.6, 1.0], color: 'dark' },
    { type: 'cube', pos: [ 0, -0.6, 0], scale: [1.5, 0.4, 1.0], color: 'orange' },
  ],
  // 24: half/half
  [
    { type: 'cube', pos: [-0.4, 0, 0], scale: [0.8, 1.6, 1.6], color: 'orange' },
    { type: 'cube', pos: [ 0.4, 0, 0], scale: [0.8, 1.6, 1.6], color: 'dark' },
  ],
  // 25: arrow up
  [
    { type: 'cube', pos: [0,    0.4, 0], scale: [0.4, 0.4, 0.6], color: 'orange' },
    { type: 'cube', pos: [-0.3, 0,   0], scale: [0.4, 0.4, 0.6], color: 'orange' },
    { type: 'cube', pos: [ 0.3, 0,   0], scale: [0.4, 0.4, 0.6], color: 'orange' },
    { type: 'cube', pos: [-0.6, -0.4, 0], scale: [0.4, 0.4, 0.6], color: 'dark' },
    { type: 'cube', pos: [ 0,   -0.4, 0], scale: [0.4, 0.4, 0.6], color: 'dark' },
    { type: 'cube', pos: [ 0.6, -0.4, 0], scale: [0.4, 0.4, 0.6], color: 'dark' },
  ],
  // 26: deep pierced
  [
    { type: 'cube', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube', pos: [0, 0, 0], scale: [0.6, 0.6, 1.7], color: 'orange' },
  ],
  // 27: floor with cube on top
  [
    { type: 'cube', pos: [0, -0.55, 0], scale: [1.6, 0.3, 1.6], color: 'orange' },
    { type: 'cube', pos: [0,  0.15, 0], scale: [0.8, 0.8, 0.8], color: 'dark' },
  ],
  // 28: tic-tac-toe with center accent
  [
    ...gridRecipe(3, 3, 0.45, ['dark', 'dark', 'dark', 'dark', 'orange', 'dark', 'dark', 'dark', 'dark']),
  ],
  // 29: triple stripe
  [
    { type: 'cube', pos: [0,  0.5, 0], scale: [1.6, 0.4, 1.6], color: 'dark' },
    { type: 'cube', pos: [0,  0,   0], scale: [1.6, 0.4, 1.6], color: 'orange' },
    { type: 'cube', pos: [0, -0.5, 0], scale: [1.6, 0.4, 1.6], color: 'dark' },
  ],
  // 30: 6 voxel cluster
  [
    { type: 'cube', pos: [-0.4, 0.3, 0], scale: [0.4, 0.4, 0.4], color: 'orange' },
    { type: 'cube', pos: [ 0,   0.3, 0], scale: [0.4, 0.4, 0.4], color: 'dark' },
    { type: 'cube', pos: [ 0.4, 0.3, 0], scale: [0.4, 0.4, 0.4], color: 'orange' },
    { type: 'cube', pos: [-0.4, -0.3, 0], scale: [0.4, 0.4, 0.4], color: 'dark' },
    { type: 'cube', pos: [ 0,   -0.3, 0], scale: [0.4, 0.4, 0.4], color: 'orange' },
    { type: 'cube', pos: [ 0.4, -0.3, 0], scale: [0.4, 0.4, 0.4], color: 'dark' },
  ],
  // 31: portal
  [
    { type: 'frame', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'orange' },
    { type: 'cube',  pos: [0, 0, 0], scale: [0.7, 0.7, 0.05], color: 'orange' },
  ],
  // 32: orange top with dark base
  [
    { type: 'cube', pos: [0, 0.3, 0], scale: [1.6, 1.0, 1.6], color: 'orange' },
    { type: 'cube', pos: [0, -0.55, 0], scale: [1.6, 0.3, 1.6], color: 'dark' },
  ],
  // 33: pixel scatter inside frame
  [
    { type: 'frame', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube', pos: [-0.3, -0.3, 0], scale: [0.2, 0.2, 0.2], color: 'orange' },
    { type: 'cube', pos: [ 0.3,  0.3, 0], scale: [0.2, 0.2, 0.2], color: 'orange' },
    { type: 'cube', pos: [ 0.3, -0.3, 0], scale: [0.2, 0.2, 0.2], color: 'orange' },
    { type: 'cube', pos: [-0.3,  0.3, 0], scale: [0.2, 0.2, 0.2], color: 'orange' },
    { type: 'cube', pos: [ 0,    0,   0], scale: [0.3, 0.3, 0.3], color: 'orange' },
  ],
  // 34: bookcase
  [
    { type: 'cube', pos: [-0.55, 0, 0], scale: [0.3, 1.6, 1.0], color: 'dark' },
    { type: 'cube', pos: [ 0,    0.5,  0], scale: [0.8, 0.18, 1.0], color: 'orange' },
    { type: 'cube', pos: [ 0,    0,    0], scale: [0.8, 0.18, 1.0], color: 'orange' },
    { type: 'cube', pos: [ 0,   -0.5,  0], scale: [0.8, 0.18, 1.0], color: 'orange' },
  ],
  // 35: frame with floating cube front
  [
    { type: 'frame', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'dark' },
    { type: 'cube',  pos: [0, 0, 0.6], scale: [0.6, 0.6, 0.4], color: 'orange' },
  ],
  // 36: 4-layer zigzag
  [
    { type: 'cube', pos: [0, -0.55, 0], scale: [1.6, 0.25, 1.6], color: 'orange' },
    { type: 'cube', pos: [0, -0.1,  0], scale: [1.6, 0.25, 0.7], color: 'dark' },
    { type: 'cube', pos: [0,  0.35, 0], scale: [0.7, 0.25, 1.6], color: 'orange' },
    { type: 'cube', pos: [0,  0.7,  0], scale: [1.6, 0.25, 1.6], color: 'dark' },
  ],
  // 37: orange cube with dark center
  [
    { type: 'cube', pos: [0, 0, 0], scale: [1.6, 1.6, 1.6], color: 'orange' },
    { type: 'cube', pos: [0, 0, 0], scale: [0.5, 0.5, 0.5], color: 'dark' },
  ],
  // 38: 2 levitating slabs
  [
    { type: 'cube', pos: [0, -0.6, 0], scale: [1.6, 0.2, 1.6], color: 'dark' },
    { type: 'cube', pos: [0,  0.6, 0], scale: [1.6, 0.2, 1.6], color: 'orange' },
  ],
  // 39: H-shape
  [
    { type: 'cube', pos: [-0.55, 0, 0], scale: [0.4, 1.6, 1.0], color: 'orange' },
    { type: 'cube', pos: [ 0.55, 0, 0], scale: [0.4, 1.6, 1.0], color: 'orange' },
    { type: 'cube', pos: [ 0,    0, 0], scale: [0.6, 0.4, 1.0], color: 'dark' },
  ],
  // 40: clean solid orange
  [
    { type: 'cube', pos: [0, 0, 0], scale: [1.5, 1.5, 1.5], color: 'orange' },
  ],
  // 41: pinwheel of small cubes
  [
    { type: 'cube', pos: [0, 0, 0], scale: [0.5, 0.5, 0.5], color: 'orange' },
    { type: 'cube', pos: [-0.55, 0.4, 0], scale: [0.4, 0.4, 0.4], color: 'dark' },
    { type: 'cube', pos: [ 0.55, 0.4, 0], scale: [0.4, 0.4, 0.4], color: 'dark' },
    { type: 'cube', pos: [-0.55, -0.4, 0], scale: [0.4, 0.4, 0.4], color: 'dark' },
    { type: 'cube', pos: [ 0.55, -0.4, 0], scale: [0.4, 0.4, 0.4], color: 'dark' },
  ],
];

function gridRecipe(cols, rows, size, colorPattern) {
  const arr = [];
  const start = -((cols - 1) * size) / 2;
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let color;
      if (colorPattern === 'alternating') color = i % 2 === 0 ? 'orange' : 'dark';
      else if (Array.isArray(colorPattern)) color = colorPattern[i % colorPattern.length];
      else color = 'orange';
      arr.push({ type: 'cube', pos: [start + c * size, start + r * size, 0], scale: [size * 0.85, size * 0.85, size * 0.85], color });
      i++;
    }
  }
  return arr;
}

// ==========================================================
// Build a Three.js mesh group from a recipe
// ==========================================================
function buildLogoMesh(recipeIdx, accentColor = null) {
  const recipe = RECIPES[recipeIdx % RECIPES.length] || RECIPES[0];
  const group = new THREE.Group();

  const orangeHex = accentColor !== null ? accentColor : COLORS.orange;

  for (const part of recipe) {
    const colorHex =
      part.color === 'orange' ? orangeHex :
      part.color === 'orangeBright' ? lighten(orangeHex, 0.15) :
      part.color === 'dark' ? COLORS.dark :
      part.color === 'darkLight' ? COLORS.darkLight :
      COLORS.darkDeep;

    if (part.type === 'cube') {
      addBox(group, part.pos, part.scale, colorHex);
    } else if (part.type === 'frame') {
      addFrame(group, part.pos, part.scale, colorHex);
    } else if (part.type === 'pierced') {
      addPierced(group, part, colorHex, orangeHex);
    }
  }

  return group;
}

function addBox(group, pos, scale, colorHex) {
  const geo = new THREE.BoxGeometry(scale[0], scale[1], scale[2]);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.5,
    metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  group.add(mesh);

  // Crisp black edge lines
  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
  const line = new THREE.LineSegments(edges, lineMat);
  line.position.copy(mesh.position);
  group.add(line);
}

function addFrame(group, pos, scale, colorHex) {
  const sx = scale[0] / 2, sy = scale[1] / 2, sz = scale[2] / 2;
  const t = 0.12;
  const bars = [
    [0, -sy, -sz, scale[0], t, t],
    [0, -sy,  sz, scale[0], t, t],
    [-sx, -sy, 0, t, t, scale[2]],
    [ sx, -sy, 0, t, t, scale[2]],
    [0,  sy, -sz, scale[0], t, t],
    [0,  sy,  sz, scale[0], t, t],
    [-sx,  sy, 0, t, t, scale[2]],
    [ sx,  sy, 0, t, t, scale[2]],
    [-sx, 0, -sz, t, scale[1], t],
    [ sx, 0, -sz, t, scale[1], t],
    [-sx, 0,  sz, t, scale[1], t],
    [ sx, 0,  sz, t, scale[1], t],
  ];
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5, metalness: 0.15 });
  for (const [x, y, z, w, h, d] of bars) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0] + x, pos[1] + y, pos[2] + z);
    group.add(mesh);
  }
}

function addPierced(group, part, colorHex, accentHex) {
  const w = part.scale[0], h = part.scale[1], d = part.scale[2];
  const hs = part.holeSize || 0.5;
  const margin = (w - hs) / 2;
  const sides = [
    [-(hs / 2 + margin / 2), 0, 0, margin, h, d],
    [ (hs / 2 + margin / 2), 0, 0, margin, h, d],
    [0, -(hs / 2 + margin / 2), 0, hs, margin, d],
    [0,  (hs / 2 + margin / 2), 0, hs, margin, d],
  ];
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5, metalness: 0.15 });
  for (const [x, y, z, sw, sh, sd] of sides) {
    const geo = new THREE.BoxGeometry(sw, sh, sd);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(part.pos[0] + x, part.pos[1] + y, part.pos[2] + z);
    group.add(mesh);
    const edges = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
    const line = new THREE.LineSegments(edges, lineMat);
    line.position.copy(mesh.position);
    group.add(line);
  }
  if (part.holeColor === 'orange') {
    const innerGeo = new THREE.BoxGeometry(hs * 0.9, hs * 0.9, d * 0.5);
    const innerMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      roughness: 0.4,
      emissive: accentHex,
      emissiveIntensity: 0.2,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.set(part.pos[0], part.pos[1], part.pos[2]);
    group.add(inner);
  }
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
// SHARED renderer for snapshots — ONE WebGL context for everything
// ==========================================================
class CubeRenderer {
  constructor() {
    this.size = 256; // high-res for sharp snapshots
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true, // needed for toDataURL
    });
    this.renderer.setPixelRatio(2);
    this.renderer.setSize(this.size, this.size, false);
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(2.6, 2.0, 2.6);
    this.camera.lookAt(0, 0, 0);

    // Lighting
    const key = new THREE.DirectionalLight(0xffd9b0, 1.3);
    key.position.set(3, 4, 2);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xb0c0d8, 0.5);
    fill.position.set(-3, -1, -2);
    this.scene.add(fill);
    this.scene.add(new THREE.AmbientLight(0x9090a0, 0.45));
    const rim = new THREE.DirectionalLight(0xffa86a, 0.4);
    rim.position.set(0, 5, -5);
    this.scene.add(rim);

    this.cache = new Map(); // idx → dataURL
  }

  // Render a logo at given idx (with optional accent color), return data URL
  snapshot(idx, accentColor = null) {
    const key = `${idx}_${accentColor ?? 'default'}`;
    if (this.cache.has(key)) return this.cache.get(key);

    // Clear scene
    while (this.scene.children.length > 4) { // keep lights
      const obj = this.scene.children[4];
      this.scene.remove(obj);
      this.disposeObj(obj);
    }

    const mesh = buildLogoMesh(idx, accentColor);
    // Pleasant fixed angle — no rotation
    mesh.rotation.x = -0.18;
    mesh.rotation.y = -0.55;
    this.scene.add(mesh);

    this.renderer.render(this.scene, this.camera);
    const url = this.canvas.toDataURL('image/png');
    this.cache.set(key, url);
    return url;
  }

  invalidateCache() {
    this.cache.clear();
  }

  disposeObj(obj) {
    obj.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }
}

let sharedRenderer = null;
function getSharedRenderer() {
  if (!sharedRenderer) sharedRenderer = new CubeRenderer();
  return sharedRenderer;
}

// ==========================================================
// PUBLIC API
// ==========================================================

// Render a cube to an <img> element by setting src to the snapshot data URL
// This is the SAFE path — no live WebGL contexts, just static images
export function renderCubeToImg(imgEl, idx, accentColor = null) {
  const renderer = getSharedRenderer();
  const url = renderer.snapshot(idx, accentColor);
  imgEl.src = url;
}

// Generate a data URL for a cube — useful for favicon
export function getCubeDataURL(idx, accentColor = null) {
  return getSharedRenderer().snapshot(idx, accentColor);
}

// When accent color changes, invalidate the cache so cubes re-render with new color
export function invalidateCubeCache() {
  if (sharedRenderer) sharedRenderer.invalidateCache();
}

// ==========================================================
// Geometric background (wireframes + particles) — 1 WebGL context only
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
      const wire = new THREE.LineSegments(edges, mat);
      wire.position.set(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 14 - 4
      );
      const scale = 0.7 + Math.random() * 1.4;
      wire.scale.set(scale, scale, scale);
      wire.userData = {
        rotSpeed: { x: (Math.random() - 0.5) * 0.003, y: (Math.random() - 0.5) * 0.003, z: (Math.random() - 0.5) * 0.003 },
        driftSpeed: { x: (Math.random() - 0.5) * 0.005 },
        startY: wire.position.y,
        bobAmount: 0.5 + Math.random() * 0.8,
        bobPhase: Math.random() * Math.PI * 2,
      };
      this.scene.add(wire);
      this.shapes.push(wire);
    }
  }

  spawnParticles(count) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const accentColor = new THREE.Color(this.accentColor);
    const coolColor = new THREE.Color(0xb8c9e0);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 25;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 18 - 4;
      const c = Math.random() > 0.6 ? accentColor : coolColor;
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      sizes[i] = 0.06 + Math.random() * 0.12;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
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
          pos.y += sin(time * 0.5 + position.x * 0.3) * 0.15;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
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
    this.shapes.forEach((s, i) => {
      if (i % 3 === 0) s.material.color.setHex(hex);
    });
    if (this.particles) {
      const colors = this.particles.geometry.attributes.color.array;
      const accentColor = new THREE.Color(hex);
      const coolColor = new THREE.Color(0xb8c9e0);
      const count = colors.length / 3;
      for (let i = 0; i < count; i++) {
        const useAccent = (i * 31337) % 5 < 2;
        const c = useAccent ? accentColor : coolColor;
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
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
      this.shapes.forEach(s => {
        const ud = s.userData;
        s.rotation.x += ud.rotSpeed.x * dt;
        s.rotation.y += ud.rotSpeed.y * dt;
        s.rotation.z += ud.rotSpeed.z * dt;
        s.position.x += ud.driftSpeed.x * dt;
        s.position.y = ud.startY + Math.sin(time + ud.bobPhase) * ud.bobAmount * 0.4;
        if (s.position.x > 18) s.position.x = -18;
        if (s.position.x < -18) s.position.x = 18;
      });
      if (this.particles) {
        this.particles.material.uniforms.time.value = time;
        this.particles.rotation.y = time * 0.02;
      }
      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }
}

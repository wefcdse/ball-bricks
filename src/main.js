import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

const CONFIG = {
  layout: 'wall',
  pyramid: { base: 4, layers: 4 },
  wall: { cols: 9, rows: 40, soldierBase: true },
  tower: { cols: 5, cycles: 15 },
  taper: { baseCols: 10 },
  ring: { radius: 1.05, cols: 13, rows: 20, z: -1.9 },
  flat: { radius: 1.15, cols: 13, rows: 40, z: -1.9 },
  cans: { radius: 0.12, length: 0.38, mass: 0.35, base: 18, layers: 18, spacing: 0.276, z: -1.9 },
  stand: { height: 0.95, thickness: 0.12, margin: 0.2625, depthMargin: -0.0125, legWidth: 0.18 },
  backWall: { z: -6, width: 90, height: 24, thickness: 1 },
  brick: { w: 0.48, h: 0.106, d: 0.23, gap: 0.012, mass: 0.45 },
  ball: { radius: 0.16, mass: 4, minSpeed: 15, maxSpeed: 32, chargeTime: 1.0 },
  camera: { height: 1.87, z: 4.6, fov: 72, pitch: 0.1 },
  targetZ: -1.9,
  maxBalls: 14,
  ballLife: 9,
};

const PALETTE = ['#b5533c', '#a94b35', '#c0644b', '#9c4530', '#b85b43', '#a85642'];

const SCENES = {
  wall: { camera: { ...CONFIG.camera } },
  tower: { camera: { height: 2.2, z: 9.5, pitch: 0.1 } },
  taper: { camera: { height: 1.8, z: 6.0, pitch: 0.08 } },
  ring: { camera: { height: 2.0, z: 4.6, pitch: 0.08 } },
  flat: { camera: { height: 2.0, z: 4.6, pitch: 0.08 } },
  cans: { camera: { height: 2.0, z: 6.2, pitch: 0.08 } },
};

const GROUND_SCENES = new Set(['ring', 'flat']);

const overlay = document.getElementById('overlay');
const hud = document.getElementById('hud');
const statsWrap = document.getElementById('statsWrap');
const ovTitle = document.getElementById('ovTitle');
const ovDesc = document.getElementById('ovDesc');
const sceneButtons = [...document.querySelectorAll('.sceneBtn')];
const powerWrap = document.getElementById('powerWrap');
const powerFill = document.getElementById('powerFill');
const powerPct = document.getElementById('powerPct');
const fallenEl = document.getElementById('fallen');
const totalEl = document.getElementById('total');
const throwsEl = document.getElementById('throws');
const resetBtn = document.getElementById('resetBtn');
const homeBtn = document.getElementById('homeBtn');
const sizeSlider = document.getElementById('sizeSlider');
const sizeLabel = document.getElementById('sizeLabel');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#dfe9f5');
scene.fog = new THREE.Fog('#dfe9f5', 26, 62);

const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov,
  window.innerWidth / window.innerHeight,
  0.05,
  120,
);
camera.rotation.order = 'YXZ';
camera.rotation.x = CONFIG.camera.pitch;
camera.position.set(0, CONFIG.camera.height, CONFIG.camera.z);

const hemi = new THREE.HemisphereLight('#ffffff', '#9db4cc', 1.5);
scene.add(hemi);

const sun = new THREE.DirectionalLight('#fff3e2', 2.6);
sun.position.set(6, 12, 8);
sun.target.position.set(0, 0, -1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -11;
sun.shadow.camera.right = 11;
sun.shadow.camera.top = 11;
sun.shadow.camera.bottom = -11;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

function makeGroundTexture() {
  const size = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#e9f0f7';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(126, 158, 190, 0.18)';
  ctx.lineWidth = 2;
  const step = size / 8;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 90),
  new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.96, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const throwLine = new THREE.Mesh(
  new THREE.PlaneGeometry(9, 0.07),
  new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.65 }),
);
throwLine.rotation.x = -Math.PI / 2;
throwLine.position.set(0, 0.004, 3.75);
scene.add(throwLine);

function makeWallTexture() {
  const size = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0, '#f7f2e9');
  grd.addColorStop(1, '#e4dbc9');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(160, 145, 125, 0.05)';
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.6 + 0.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const BW = CONFIG.backWall;
const backWall = new THREE.Mesh(
  new THREE.BoxGeometry(BW.width, BW.height, BW.thickness),
  new THREE.MeshStandardMaterial({ map: makeWallTexture(), roughness: 0.96, metalness: 0 }),
);
backWall.position.set(0, BW.height / 2, BW.z - BW.thickness / 2);
backWall.receiveShadow = true;
scene.add(backWall);

const baseboard = new THREE.Mesh(
  new THREE.BoxGeometry(BW.width, 0.3, 0.08),
  new THREE.MeshStandardMaterial({ color: '#e2d9ca', roughness: 0.9 }),
);
baseboard.position.set(0, 0.15, BW.z + 0.02);
baseboard.receiveShadow = true;
scene.add(baseboard);

function makeBrickTexture() {
  const w = 256;
  const h = 128;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#e8e1d8';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const v = Math.floor(120 + Math.random() * 100);
    ctx.fillStyle = `rgba(${v},${v - 10},${v - 20},${0.04 + Math.random() * 0.08})`;
    const x = Math.random() * w;
    const y = Math.random() * h;
    const s = 0.6 + Math.random() * 1.8;
    ctx.fillRect(x, y, s, s);
  }
  ctx.strokeStyle = 'rgba(90, 55, 40, 0.16)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const brickTexture = makeBrickTexture();
const brickGeo = new RoundedBoxGeometry(
  CONFIG.brick.w, CONFIG.brick.h, CONFIG.brick.d, 2, 0.008,
);
const ballGeo = new THREE.SphereGeometry(CONFIG.ball.radius, 24, 18);
const ballMat = new THREE.MeshStandardMaterial({
  color: '#ff6b57', roughness: 0.4, metalness: 0.05,
});
const canLabels = ['#b7483e', '#2f6f5c', '#3b6ea5', '#c78a33', '#6a4c93', '#b04a6b'];

function makeCanLabelTexture(label) {
  const w = 256;
  const h = 128;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');

  const metal = ctx.createLinearGradient(0, 0, 0, h);
  metal.addColorStop(0, '#f3f5f7');
  metal.addColorStop(0.45, '#d3d9df');
  metal.addColorStop(1, '#aeb6bf');
  ctx.fillStyle = metal;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(255, 255, 255, .18)';
  for (let i = 0; i < 18; i++) {
    ctx.fillRect(Math.random() * w, 0, 1, h);
  }

  ctx.fillStyle = label;
  ctx.fillRect(0, 40, w, 48);
  ctx.fillStyle = 'rgba(255, 255, 255, .82)';
  ctx.fillRect(0, 47, w, 2);
  ctx.fillRect(0, 79, w, 2);
  ctx.fillStyle = 'rgba(255, 255, 255, .2)';
  ctx.fillRect(0, 54, w, 18);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(26 + i * 46, 64, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, .5)';
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(72, 82, 93, .3)';
  ctx.fillRect(0, 3, w, 3);
  ctx.fillRect(0, h - 6, w, 3);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function makeCanGeometry() {
  const r = CONFIG.cans.radius;
  const h = CONFIG.cans.length;
  const profile = [
    new THREE.Vector2(0, -h / 2),
    new THREE.Vector2(r * 0.7, -h / 2),
    new THREE.Vector2(r * 0.95, -h / 2 + 0.01),
    new THREE.Vector2(r, -h / 2 + 0.035),
    new THREE.Vector2(r, h / 2 - 0.055),
    new THREE.Vector2(r * 0.92, h / 2 - 0.025),
    new THREE.Vector2(r * 0.8, h / 2),
    new THREE.Vector2(0, h / 2),
  ];
  return new THREE.LatheGeometry(profile, 24);
}

const canTextures = canLabels.map((label) => makeCanLabelTexture(label));
const canGeo = makeCanGeometry();

function makeCanMaterial() {
  const tex = canTextures[Math.floor(Math.random() * canTextures.length)];
  return new THREE.MeshStandardMaterial({
    map: tex,
    metalness: 0.45 + Math.random() * 0.2,
    roughness: 0.28 + Math.random() * 0.14,
  });
}

const bricks = [];
const balls = [];
const ballColliders = new Map();
let towerBounds = null;
let fallenCount = 0;
let throwCount = 0;

function makeDotTexture() {
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.55, 'rgba(255,255,255,1)');
  grd.addColorStop(0.78, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const dotTexture = makeDotTexture();
const previewCount = 90;
const previewPositions = new Float32Array(previewCount * 3);
const previewGeo = new THREE.BufferGeometry();
previewGeo.setAttribute('position', new THREE.BufferAttribute(previewPositions, 3));
previewGeo.setDrawRange(0, 0);
const previewDot = (size, color, opacity) => new THREE.Points(
  previewGeo,
  new THREE.PointsMaterial({
    color, map: dotTexture, size, sizeAttenuation: false,
    transparent: true, opacity, depthTest: false, depthWrite: false,
    alphaTest: 0.02,
  }),
);
const previewBack = previewDot(9, '#1f3b55', 0.7);
const previewFront = previewDot(5.5, '#ffffff', 0.95);
previewBack.frustumCulled = false;
previewFront.frustumCulled = false;
previewBack.renderOrder = 900;
previewFront.renderOrder = 901;
scene.add(previewBack, previewFront);

const aimRing = new THREE.Mesh(
  new THREE.RingGeometry(0.1, 0.15, 32),
  new THREE.MeshBasicMaterial({
    color: '#ff5a4f', transparent: true, opacity: 0.95,
    depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  }),
);
aimRing.renderOrder = 910;
aimRing.visible = false;
scene.add(aimRing);

const raycaster = new THREE.Raycaster();
const mouseNdc = new THREE.Vector2(0, 0);
const aimPoint = new THREE.Vector3();
const aimNormal = new THREE.Vector3(0, 0, 1);
const throwDir = new THREE.Vector3(0, 0, -1);
const RING_FORWARD = new THREE.Vector3(0, 0, 1);
let lastMouseX = window.innerWidth / 2;
let lastMouseY = window.innerHeight / 2;

const P_MAX = 260;
const pPositions = new Float32Array(P_MAX * 3);
const pVel = new Float32Array(P_MAX * 3);
const pLife = new Float32Array(P_MAX);
for (let i = 0; i < P_MAX; i++) pPositions[i * 3 + 1] = -999;
const pGeo = new THREE.BufferGeometry();
const pAttr = new THREE.BufferAttribute(pPositions, 3);
pGeo.setAttribute('position', pAttr);
const particles = new THREE.Points(
  pGeo,
  new THREE.PointsMaterial({
    color: '#ffe0bd', size: 0.075, sizeAttenuation: true,
    transparent: true, opacity: 0.95, depthWrite: false,
  }),
);
particles.frustumCulled = false;
scene.add(particles);
let pCursor = 0;

let world = null;
let eventQueue = null;
let ready = false;
let started = false;
let currentScene = 'wall';
let charging = false;
let chargeStart = 0;
let power = 0;
let ballRadius = CONFIG.ball.radius;

const tmpForward = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function aimDirection(out) {
  return out.set(0, 0, -1).applyQuaternion(camera.quaternion);
}

function launchPoint(out) {
  aimDirection(tmpForward);
  const forward = 0.62 + Math.max(0, ballRadius - CONFIG.ball.radius) * 1.4;
  return out.copy(camera.position)
    .addScaledVector(tmpForward, forward)
    .addScaledVector(UP, -0.38);
}

function currentSpeed(value = power) {
  return CONFIG.ball.minSpeed + (CONFIG.ball.maxSpeed - CONFIG.ball.minSpeed) * value;
}

function placeAimRing() {
  aimRing.position.copy(aimPoint).addScaledVector(aimNormal, 0.02);
  aimRing.quaternion.setFromUnitVectors(RING_FORWARD, aimNormal);
  aimRing.visible = started;
}

function setDefaultAim() {
  if (towerBounds) {
    aimPoint.set(0, (towerBounds.min.y + towerBounds.max.y) / 2, towerBounds.max.z + 0.01);
  } else {
    aimPoint.set(0, 0.8, CONFIG.targetZ + 0.8);
  }
  aimNormal.set(0, 0, 1);
  placeAimRing();
}

function updateAimFromScreen(clientX, clientY) {
  lastMouseX = clientX;
  lastMouseY = clientY;
  mouseNdc.x = (clientX / window.innerWidth) * 2 - 1;
  mouseNdc.y = -(clientY / window.innerHeight) * 2 + 1;
  camera.updateMatrixWorld();
  raycaster.setFromCamera(mouseNdc, camera);
  const targets = bricks.map((b) => b.mesh);
  targets.push(ground, backWall, ...standMeshes.filter((m) => m.visible));
  const hits = raycaster.intersectObjects(targets, false);
  if (hits.length > 0) {
    const hit = hits[0];
    aimPoint.copy(hit.point);
    if (hit.face) {
      aimNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).normalize();
    } else {
      aimNormal.copy(UP);
    }
  } else {
    aimPoint.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, 26);
    aimNormal.copy(raycaster.ray.direction).negate();
  }
  placeAimRing();
  if (charging) refreshThrowDir();
}

function refreshThrowDir() {
  throwDir.copy(aimPoint).sub(launchPoint(new THREE.Vector3())).normalize();
}

function buildLayout() {
  const layout = [];
  const { w, h, d } = CONFIG.brick;
  const gap = CONFIG.brick.gap;
  const z0 = CONFIG.targetZ;
  const baseY = CONFIG.stand.height + 0.002;
  const wallBaseY = CONFIG.stand.height + (CONFIG.wall.soldierBase ? w : 0) + 0.006;

  if (CONFIG.layout === 'wall') {
    const { cols, rows } = CONFIG.wall;
    for (let r = 0; r < rows; r++) {
      const n = cols - (r % 2);
      for (let c = 0; c < n; c++) {
        layout.push({
          x: (c - (n - 1) / 2) * (w + gap),
          y: wallBaseY + h / 2 + r * (h + gap),
          z: z0,
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        });
      }
    }
    return layout;
  }

  const { base, layers } = CONFIG.pyramid;
  for (let layer = 0; layer < layers; layer++) {
    const n = base - layer;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        layout.push({
          x: (i - (n - 1) / 2) * (w + gap),
          y: baseY + h / 2 + layer * (h + gap),
          z: z0 + (j - (n - 1) / 2) * (d + gap),
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        });
      }
    }
  }
  return layout;
}

const standSpecs = buildLayout();
let standMinX = Infinity;
let standMaxX = -Infinity;
let standMinZ = Infinity;
let standMaxZ = -Infinity;
for (const s of standSpecs) {
  standMinX = Math.min(standMinX, s.x);
  standMaxX = Math.max(standMaxX, s.x);
  standMinZ = Math.min(standMinZ, s.z);
  standMaxZ = Math.max(standMaxZ, s.z);
}

const stand = {
  cx: (standMinX + standMaxX) / 2,
  cz: (standMinZ + standMaxZ) / 2,
  width: (standMaxX - standMinX) + CONFIG.brick.w + CONFIG.stand.margin * 2,
  depth: (standMaxZ - standMinZ) + CONFIG.brick.d + CONFIG.stand.depthMargin,
  height: CONFIG.stand.height,
  thickness: CONFIG.stand.thickness,
  legWidth: CONFIG.stand.legWidth,
};
stand.legHeight = stand.height - stand.thickness;
stand.legDepth = stand.depth - 0.12;
stand.legX = stand.width / 2 - stand.legWidth / 2 - 0.03;

const shelfMat = new THREE.MeshStandardMaterial({ color: '#c99a67', roughness: 0.82, metalness: 0 });
const legMat = new THREE.MeshStandardMaterial({ color: '#a97b4f', roughness: 0.88, metalness: 0 });

const shelfMesh = new THREE.Mesh(
  new THREE.BoxGeometry(stand.width, stand.thickness, stand.depth),
  shelfMat,
);
shelfMesh.position.set(stand.cx, stand.height - stand.thickness / 2, stand.cz);
shelfMesh.castShadow = true;
shelfMesh.receiveShadow = true;
scene.add(shelfMesh);

const standMeshes = [shelfMesh];
const standBodies = [];
for (const side of [-1, 1]) {
  const legMesh = new THREE.Mesh(
    new THREE.BoxGeometry(stand.legWidth, stand.legHeight, stand.legDepth),
    legMat,
  );
  legMesh.position.set(stand.cx + side * stand.legX, stand.legHeight / 2, stand.cz);
  legMesh.castShadow = true;
  legMesh.receiveShadow = true;
  scene.add(legMesh);
  standMeshes.push(legMesh);
}

function createBrickBody({ x, y, z, color }, localHalf, boundHalf, rotation = null) {
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y, z)
    .setLinearDamping(0.12)
    .setAngularDamping(0.35);
  if (rotation) bodyDesc.setRotation(rotation);
  const body = world.createRigidBody(bodyDesc);

  const colliderDesc = RAPIER.ColliderDesc.cuboid(
    localHalf.x, localHalf.y, localHalf.z,
  )
    .setMass(CONFIG.brick.mass)
    .setFriction(0.78)
    .setRestitution(0.04);
  world.createCollider(colliderDesc, body);

  const mat = new THREE.MeshStandardMaterial({
    color, map: brickTexture, roughness: 0.9, metalness: 0,
  });
  mat.color.offsetHSL(
    (Math.random() - 0.5) * 0.01, 0, (Math.random() - 0.5) * 0.07,
  );
  const mesh = new THREE.Mesh(brickGeo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const brick = {
    body, mesh, fallen: false,
    hx: boundHalf.x, hy: boundHalf.y, hz: boundHalf.z,
    initial: new THREE.Vector3(x, y, z),
  };
  bricks.push(brick);
}

function createBrick(spec) {
  const { w, h, d } = CONFIG.brick;
  const half = { x: w / 2, y: h / 2, z: d / 2 };
  createBrickBody(spec, half, half);
}

function createUpright(spec) {
  const { w, h, d } = CONFIG.brick;
  const localHalf = { x: w / 2, y: h / 2, z: d / 2 };
  const boundHalf = { x: h / 2, y: w / 2, z: d / 2 };
  const rotation = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 };
  createBrickBody(spec, localHalf, boundHalf, rotation);
}

function createSoldierBase() {
  const { w, gap } = CONFIG.brick;
  const n = CONFIG.wall.cols;
  const step = w + gap;
  const y = CONFIG.stand.height + w / 2 + 0.001;
  const centers = [];
  for (let c = 0; c < n; c++) {
    centers.push((c - (n - 1) / 2) * step);
  }
  const supports = [centers[0] - w / 2];
  for (let c = 0; c < n - 1; c++) {
    supports.push((centers[c] + centers[c + 1]) / 2);
  }
  supports.push(centers[n - 1] + w / 2);
  for (const x of supports) {
    createUpright({
      x,
      y,
      z: CONFIG.targetZ,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    });
  }
}

function buildTower() {
  const { w, h, gap } = CONFIG.brick;
  const n = CONFIG.tower.cols;
  const cycles = CONFIG.tower.cycles;
  const step = w + gap;
  const centers = [];
  for (let c = 0; c < n; c++) {
    centers.push((c - (n - 1) / 2) * step);
  }

  const halfUpright = h / 2;
  const supports = [centers[0] - w / 2 + halfUpright];
  for (let c = 0; c < n - 1; c++) {
    supports.push((centers[c] + centers[c + 1]) / 2);
  }
  supports.push(centers[n - 1] + w / 2 - halfUpright);

  let bottom = CONFIG.stand.height + 0.001;
  for (let level = 0; level < cycles; level++) {
    const uprightY = bottom + w / 2;
    for (const x of supports) {
      createUpright({
        x,
        y: uprightY,
        z: CONFIG.targetZ,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      });
    }
    bottom += w;

    const brickY = bottom + 0.001 + h / 2;
    for (const x of centers) {
      createBrick({
        x,
        y: brickY,
        z: CONFIG.targetZ,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      });
    }
    bottom += 0.001 + h;
  }
}

function buildTaperTower() {
  const { w, h, gap } = CONFIG.brick;
  const baseCols = CONFIG.taper.baseCols;
  const step = w + gap;
  const halfUpright = h / 2;

  const levels = [];
  for (let n = baseCols; n >= 1; n -= 1) {
    levels.push(n);
  }

  let bottom = CONFIG.stand.height + 0.001;
  for (const n of levels) {
    const centers = [];
    for (let c = 0; c < n; c++) {
      centers.push((c - (n - 1) / 2) * step);
    }

    const supports = [centers[0] - w / 2 + halfUpright];
    for (let c = 0; c < n - 1; c++) {
      supports.push((centers[c] + centers[c + 1]) / 2);
    }
    supports.push(centers[n - 1] + w / 2 - halfUpright);

    const uprightY = bottom + w / 2;
    for (const x of supports) {
      createUpright({
        x,
        y: uprightY,
        z: CONFIG.targetZ,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      });
    }
    bottom += w;

    const brickY = bottom + 0.001 + h / 2;
    for (const x of centers) {
      createBrick({
        x,
        y: brickY,
        z: CONFIG.targetZ,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      });
    }
    bottom += 0.001 + h;
  }
}

function createRingBrick(spec, quat) {
  const { w, h, d } = CONFIG.brick;
  const localHalf = { x: w / 2, y: h / 2, z: d / 2 };
  const boundHalf = { x: w / 2, y: d / 2, z: w / 2 };
  createBrickBody(spec, localHalf, boundHalf, { x: quat.x, y: quat.y, z: quat.z, w: quat.w });
}

function buildRingTower() {
  const { d, gap } = CONFIG.brick;
  const { radius, cols, rows, z: centerZ } = CONFIG.ring;
  const step = (Math.PI * 2) / cols;
  const baseY = d / 2 + 0.002;
  const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (step / 2);
    for (let i = 0; i < cols; i++) {
      const phi = i * step + offset;
      const q = new THREE.Quaternion()
        .setFromAxisAngle(UP, -phi - Math.PI / 2)
        .multiply(qX);
      createRingBrick({
        x: Math.cos(phi) * radius,
        y: baseY + r * (d + gap),
        z: centerZ + Math.sin(phi) * radius,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      }, q);
    }
  }
}

function createFlatRingBrick(spec, quat) {
  const { w, h, d } = CONFIG.brick;
  const localHalf = { x: w / 2, y: h / 2, z: d / 2 };
  const boundHalf = { x: w / 2, y: h / 2, z: w / 2 };
  createBrickBody(spec, localHalf, boundHalf, { x: quat.x, y: quat.y, z: quat.z, w: quat.w });
}

function buildFlatRing() {
  const { h, gap } = CONFIG.brick;
  const { radius, cols, rows, z: centerZ } = CONFIG.flat;
  const step = (Math.PI * 2) / cols;
  const baseY = h / 2 + 0.002;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (step / 2);
    for (let i = 0; i < cols; i++) {
      const phi = i * step + offset;
      const q = new THREE.Quaternion().setFromAxisAngle(UP, -phi - Math.PI / 2);
      createFlatRingBrick({
        x: Math.cos(phi) * radius,
        y: baseY + r * (h + gap),
        z: centerZ + Math.sin(phi) * radius,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      }, q);
    }
  }
}

function createCan({ x, y, z }) {
  const { radius, length, mass } = CONFIG.cans;
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y, z)
    .setLinearDamping(0.12)
    .setAngularDamping(0.25);
  const body = world.createRigidBody(bodyDesc);

  world.createCollider(
    RAPIER.ColliderDesc.cylinder(length / 2, radius)
      .setMass(mass)
      .setFriction(0.55)
      .setRestitution(0.18),
    body,
  );

  const mesh = new THREE.Mesh(canGeo, makeCanMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  bricks.push({
    body, mesh, fallen: false,
    hx: radius, hy: length / 2, hz: radius,
    initial: new THREE.Vector3(x, y, z),
  });
}

function buildCanTower() {
  const { length, base, layers, spacing, z: centerZ } = CONFIG.cans;
  const baseY = CONFIG.stand.height + length / 2 + 0.002;

  for (let layer = 0; layer < layers; layer++) {
    const n = base - layer;
    if (n < 1) break;
    for (let i = 0; i < n; i++) {
      createCan({
        x: (i - (n - 1) / 2) * spacing,
        y: baseY + layer * (length + 0.002),
        z: centerZ,
      });
    }
  }
}

function computeTowerBounds() {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const b of bricks) {
    const t = b.body.translation();
    min.x = Math.min(min.x, t.x - b.hx);
    min.y = Math.min(min.y, t.y - b.hy);
    min.z = Math.min(min.z, t.z - b.hz);
    max.x = Math.max(max.x, t.x + b.hx);
    max.y = Math.max(max.y, t.y + b.hy);
    max.z = Math.max(max.z, t.z + b.hz);
  }
  towerBounds = bricks.length ? { min, max } : null;
}

function settle() {
  for (let i = 0; i < 90; i++) world.step();
  for (const b of bricks) {
    const t = b.body.translation();
    b.initial.set(t.x, t.y, t.z);
    const q = b.body.rotation();
    b.initialQuat = { x: q.x, y: q.y, z: q.z, w: q.w };
  }
  computeTowerBounds();
}

function clearBricks() {
  for (const b of bricks) {
    world.removeRigidBody(b.body);
    scene.remove(b.mesh);
    b.mesh.material.dispose();
  }
  bricks.length = 0;
}

function spawnBricks() {
  clearBricks();
  if (currentScene === 'tower') {
    buildTower();
  } else if (currentScene === 'taper') {
    buildTaperTower();
  } else if (currentScene === 'ring') {
    buildRingTower();
  } else if (currentScene === 'flat') {
    buildFlatRing();
  } else if (currentScene === 'cans') {
    buildCanTower();
  } else {
    for (const spec of buildLayout()) createBrick(spec);
    if (CONFIG.layout === 'wall' && CONFIG.wall.soldierBase) createSoldierBase();
  }
  settle();
  syncMeshes();
  setDefaultAim();
  fallenCount = 0;
  fallenEl.textContent = '0';
  totalEl.textContent = String(bricks.length);
}

function removeBall(ball) {
  world.removeRigidBody(ball.body);
  scene.remove(ball.mesh);
  ballColliders.delete(ball.handle);
  const i = balls.indexOf(ball);
  if (i >= 0) balls.splice(i, 1);
}

function clearBalls() {
  for (const ball of balls.slice()) removeBall(ball);
}

function throwBall(value) {
  const spawn = launchPoint(new THREE.Vector3());
  const speed = currentSpeed(value);

  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(spawn.x, spawn.y, spawn.z)
    .setLinvel(throwDir.x * speed, throwDir.y * speed, throwDir.z * speed)
    .setAngvel({
      x: (Math.random() - 0.5) * 9,
      y: (Math.random() - 0.5) * 9,
      z: (Math.random() - 0.5) * 9,
    })
    .setLinearDamping(0.06)
    .setAngularDamping(0.24)
    .setCcdEnabled(true);
  const body = world.createRigidBody(bodyDesc);

  const scale = ballRadius / CONFIG.ball.radius;
  const mass = CONFIG.ball.mass * scale * scale * scale;
  const colliderDesc = RAPIER.ColliderDesc.ball(ballRadius)
    .setMass(mass)
    .setFriction(0.42)
    .setRestitution(0.34)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
  const collider = world.createCollider(colliderDesc, body);

  const mesh = new THREE.Mesh(ballGeo, ballMat);
  mesh.scale.setScalar(scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const ball = {
    body, mesh, handle: collider.handle,
    age: 0, lastImpact: 0,
    pos: new THREE.Vector3(), quat: new THREE.Quaternion(),
  };
  balls.push(ball);
  ballColliders.set(collider.handle, ball);

  while (balls.length > CONFIG.maxBalls) removeBall(balls[0]);

  throwCount++;
  throwsEl.textContent = String(throwCount);
  spawnParticles(spawn, 6);
}

function spawnParticles(pos, count) {
  for (let n = 0; n < count; n++) {
    const i = pCursor;
    pCursor = (pCursor + 1) % P_MAX;
    pPositions[i * 3] = pos.x + (Math.random() - 0.5) * 0.12;
    pPositions[i * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.12;
    pPositions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.12;
    pVel[i * 3] = (Math.random() - 0.5) * 3.2;
    pVel[i * 3 + 1] = 0.8 + Math.random() * 2.6;
    pVel[i * 3 + 2] = (Math.random() - 0.5) * 3.2;
    pLife[i] = 0.35 + Math.random() * 0.35;
  }
}

function updateParticles(dt) {
  for (let i = 0; i < P_MAX; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt;
    if (pLife[i] <= 0) {
      pPositions[i * 3 + 1] = -999;
      continue;
    }
    pVel[i * 3 + 1] -= 12 * dt;
    pPositions[i * 3] += pVel[i * 3] * dt;
    pPositions[i * 3 + 1] += pVel[i * 3 + 1] * dt;
    pPositions[i * 3 + 2] += pVel[i * 3 + 2] * dt;
  }
  pAttr.needsUpdate = true;
}

function updatePreview() {
  if (!charging) {
    previewGeo.setDrawRange(0, 0);
    return;
  }
  const p = launchPoint(new THREE.Vector3());
  const speed = currentSpeed();
  let vx = throwDir.x * speed;
  let vy = throwDir.y * speed;
  let vz = throwDir.z * speed;
  const dt = 0.01;
  let count = 0;
  for (let i = 0; i < previewCount; i++) {
    previewPositions[i * 3] = p.x;
    previewPositions[i * 3 + 1] = p.y;
    previewPositions[i * 3 + 2] = p.z;
    count = i + 1;
    vy -= 9.81 * dt;
    p.x += vx * dt;
    p.y += vy * dt;
    p.z += vz * dt;
    if (p.y < 0.04) break;
    if (p.z <= BW.z + 0.02) break;
    if (
      towerBounds &&
      p.x > towerBounds.min.x && p.x < towerBounds.max.x &&
      p.y > towerBounds.min.y && p.y < towerBounds.max.y &&
      p.z > towerBounds.min.z && p.z < towerBounds.max.z
    ) break;
  }
  previewGeo.setDrawRange(0, count);
  previewGeo.attributes.position.needsUpdate = true;
}

function updateBricks() {
  let changed = false;
  for (const b of bricks) {
    if (b.fallen) continue;
    const t = b.body.translation();
    const q = b.body.rotation();
    const iq = b.initialQuat;
    const alignment = Math.abs(q.x * iq.x + q.y * iq.y + q.z * iq.z + q.w * iq.w);
    const dx = t.x - b.initial.x;
    const dy = t.y - b.initial.y;
    const dz = t.z - b.initial.z;
    if (dx * dx + dy * dy + dz * dz > 0.05 || alignment < 0.94) {
      b.fallen = true;
      fallenCount++;
      changed = true;
    }
  }
  if (changed) fallenEl.textContent = String(fallenCount);
}

function syncMeshes() {
  for (const b of bricks) {
    const t = b.body.translation();
    const q = b.body.rotation();
    b.mesh.position.set(t.x, t.y, t.z);
    b.mesh.quaternion.set(q.x, q.y, q.z, q.w);
  }
  for (const ball of balls) {
    const t = ball.body.translation();
    const q = ball.body.rotation();
    ball.pos.set(t.x, t.y, t.z);
    ball.quat.set(q.x, q.y, q.z, q.w);
    ball.mesh.position.copy(ball.pos);
    ball.mesh.quaternion.copy(ball.quat);
  }
}

function handleEvents() {
  eventQueue.drainCollisionEvents((h1, h2, began) => {
    if (!began) return;
    const ball = ballColliders.get(h1) || ballColliders.get(h2);
    if (!ball) return;
    const now = performance.now();
    if (now - ball.lastImpact < 70) return;
    ball.lastImpact = now;
    const t = ball.body.translation();
    spawnParticles(t, 7);
  });
}

function updateBalls(dt) {
  for (const ball of balls.slice()) {
    ball.age += dt;
    const t = ball.body.translation();
    if (ball.age > CONFIG.ballLife || t.y < -8) removeBall(ball);
  }
}

function beginCharge(clientX, clientY) {
  if (!ready || !started || charging) return;
  updateAimFromScreen(clientX, clientY);
  refreshThrowDir();
  charging = true;
  chargeStart = performance.now();
  power = 0;
  powerFill.style.transform = 'scaleX(0)';
  powerPct.textContent = '0%';
  powerWrap.classList.add('on');
}

function cancelCharge() {
  charging = false;
  power = 0;
  powerWrap.classList.remove('on');
  previewGeo.setDrawRange(0, 0);
}

function endCharge() {
  if (!charging) return;
  const value = power;
  cancelCharge();
  if (value > 0.01) throwBall(value);
}

function updateCharge() {
  if (!charging) return;
  power = Math.min(1, (performance.now() - chargeStart) / (CONFIG.ball.chargeTime * 1000));
  powerFill.style.transform = `scaleX(${power.toFixed(3)})`;
  powerPct.textContent = `${Math.round(power * 100)}%`;
}

function resetGame() {
  if (!started) return;
  cancelCharge();
  clearBalls();
  spawnBricks();
  throwCount = 0;
  throwsEl.textContent = '0';
}

function applyCamera(spec) {
  camera.position.set(0, spec.height, spec.z);
  camera.rotation.x = spec.pitch;
  camera.updateMatrixWorld();
}

function goHome() {
  if (!started) return;
  cancelCharge();
  clearBalls();
  started = false;
  currentScene = null;
  aimRing.visible = false;
  overlay.classList.remove('hidden');
  document.body.classList.remove('playing');
}

function setStandVisible(visible) {
  for (const mesh of standMeshes) mesh.visible = visible;
  for (const entry of standBodies) {
    const p = visible ? entry.home : { x: entry.home.x, y: -100, z: entry.home.z };
    entry.body.setTranslation(p, true);
  }
}

function startScene(name) {
  if (!ready || started) return;
  const scene = SCENES[name];
  if (!scene) return;
  setStandVisible(!GROUND_SCENES.has(name));
  throwCount = 0;
  throwsEl.textContent = '0';
  if (currentScene !== name) {
    currentScene = name;
    spawnBricks();
  }
  applyCamera(scene.camera);
  started = true;
  overlay.classList.add('hidden');
  document.body.classList.add('playing');
  setDefaultAim();
}

for (const btn of sceneButtons) {
  btn.addEventListener('click', () => startScene(btn.dataset.scene));
}

function updateHudLayout() {
  const width = window.innerWidth;
  const compact = width < 560;
  const narrow = width < 390;
  hud.classList.toggle('compact', compact);
  hud.classList.toggle('narrow', narrow);
  statsWrap.classList.toggle('compact', compact);
  statsWrap.classList.toggle('narrow', narrow);
}

updateHudLayout();
window.addEventListener('resize', updateHudLayout);

resetBtn.addEventListener('click', () => {
  resetBtn.blur();
  resetGame();
});

homeBtn.addEventListener('click', () => {
  homeBtn.blur();
  goHome();
});

function updateBallSize() {
  const t = Number(sizeSlider.value) / 1000;
  const diameterCm = 16 * Math.pow(200 / 16, t);
  ballRadius = diameterCm / 200;
  sizeLabel.textContent = `${Math.round(diameterCm)}cm`;
}

sizeSlider.addEventListener('input', updateBallSize);
updateBallSize();

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  try {
    renderer.domElement.setPointerCapture(e.pointerId);
  } catch {}
  beginCharge(e.clientX, e.clientY);
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!started || !e.isPrimary) return;
  if (e.pointerType === 'touch' && !charging) return;
  updateAimFromScreen(e.clientX, e.clientY);
});

window.addEventListener('pointerup', (e) => {
  if (!e.isPrimary) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  endCharge();
});

window.addEventListener('pointercancel', (e) => {
  if (!e.isPrimary) return;
  cancelCharge();
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r') resetGame();
});

window.addEventListener('blur', cancelCharge);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

const FIXED = 1 / 60;
let acc = 0;
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  updateCharge();
  if (aimRing.visible) {
    aimRing.scale.setScalar(1 + Math.sin(now * 0.006) * 0.08);
  }

  if (world) {
    acc += dt;
    let steps = 0;
    while (acc >= FIXED && steps < 4) {
      world.step(eventQueue);
      handleEvents();
      acc -= FIXED;
      steps++;
    }
    if (steps === 4) acc = 0;

    syncMeshes();
    updateBricks();
    updateBalls(dt);
    updateParticles(dt);
  }

  updatePreview();
  renderer.render(scene, camera);
}

async function boot() {
  try {
    await RAPIER.init();
    world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = FIXED;
    world.integrationParameters.numSolverIterations = 8;
    eventQueue = new RAPIER.EventQueue(true);

    const groundBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(45, 0.5, 45).setFriction(0.9).setRestitution(0.05),
      groundBody,
    );

    const wallBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, BW.height / 2, BW.z - BW.thickness / 2),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(BW.width / 2, BW.height / 2, BW.thickness / 2)
        .setFriction(0.55)
        .setRestitution(0.12),
      wallBody,
    );

    const shelfBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(
        stand.cx, stand.height - stand.thickness / 2, stand.cz,
      ),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(stand.width / 2, stand.thickness / 2, stand.depth / 2)
        .setFriction(0.9)
        .setRestitution(0.04),
      shelfBody,
    );
    standBodies.push({
      body: shelfBody,
      home: { x: stand.cx, y: stand.height - stand.thickness / 2, z: stand.cz },
    });

    for (const side of [-1, 1]) {
      const legBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(
          stand.cx + side * stand.legX, stand.legHeight / 2, stand.cz,
        ),
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(stand.legWidth / 2, stand.legHeight / 2, stand.legDepth / 2)
          .setFriction(0.9)
          .setRestitution(0.04),
        legBody,
      );
      standBodies.push({
        body: legBody,
        home: { x: stand.cx + side * stand.legX, y: stand.legHeight / 2, z: stand.cz },
      });
    }

    spawnBricks();
    ready = true;
    ovDesc.innerHTML = '选择要砸的场景 · 点击卡片开始<br><b>按住蓄力、拖动瞄准，松开投掷</b>';
    for (const btn of sceneButtons) btn.disabled = false;
    animate();
  } catch (err) {
    console.error(err);
    ovTitle.textContent = '加载失败';
    ovDesc.textContent = '物理引擎初始化失败，请通过本地 HTTP 服务打开本页（见 README）。';
    for (const btn of sceneButtons) btn.disabled = true;
  }
}

boot();

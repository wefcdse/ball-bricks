import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

const CONFIG = {
  layout: 'wall',
  pyramid: { base: 4, layers: 4 },
  wall: { cols: 9, rows: 40, soldierBase: true },
  framedWall: { cols: 12, rows: 40 },
  tower: { cols: 5, cycles: 15 },
  towerCans: { cols: 8 },
  taper: { baseCols: 10 },
  ring: { radius: 1.05, cols: 13, rows: 20, z: -1.9 },
  flat: { radius: 1.15, cols: 13, rows: 40, z: -1.9 },
  cans: { radius: 0.12, length: 0.38, mass: 0.35, base: 18, layers: 18, spacing: 0.276, z: -1.9 },
  canPyramid: { base: 12 },
  brickPile: { nx: 4, nz: 8, layers: 18 },
  brickPillars: { count: 8, spacing: 0.55, layers: 18, z: -0.8 },  stand: { height: 0.95, thickness: 0.12, margin: 0.2625, depthMargin: -0.0125, legWidth: 0.18 },
  backWall: { z: -6, width: 90, height: 24, thickness: 1 },
  brick: { w: 0.48, h: 0.106, d: 0.23, gap: 0.012, mass: 0.45 },
  ball: { radius: 0.16, mass: 4, minSpeed: 15, maxSpeed: 32, chargeTime: 1.0 },
  camera: { height: 3.12, z: 4.6, fov: 72, pitch: -0.7 * Math.PI / 180 },
  targetZ: -1.9,
  maxBalls: 14,
  ballLife: 9,
};

const PALETTE = ['#b5533c', '#a94b35', '#c0644b', '#9c4530', '#b85b43', '#a85642'];

const BALL_GROUP = 0x0001;
const FIXED_BRICK_GROUP = 0x0002;
const STAND_GROUP = 0x0004;
const BOMB_GROUP = 0x0008;
const BALL_COLLISION_GROUPS = (BALL_GROUP << 16) | (0xFFFF & ~FIXED_BRICK_GROUP & ~STAND_GROUP);
const FIXED_BRICK_COLLISION_GROUPS = (FIXED_BRICK_GROUP << 16) | (0xFFFF & ~BALL_GROUP);
const STAND_COLLISION_GROUPS = (STAND_GROUP << 16) | (0xFFFF & ~BALL_GROUP);
const BOMB_COLLISION_GROUPS = (BOMB_GROUP << 16) | 0xFFFF;

const SCENES = {
  wall: { camera: { ...CONFIG.camera } },
  framedWall: { camera: { height: 1.9, z: 5.6, pitch: 0.1 } },
  tower: { camera: { height: 4.65, z: 7.05, pitch: 0.5 * Math.PI / 180 } },
  towerCans: { camera: { height: 3.65, z: 7.9, pitch: 5.3 * Math.PI / 180 } },
  taper: { camera: { height: 2, z: 5.4, pitch: 6.8 * Math.PI / 180 } },
  taperCans: { camera: { height: 2.55, z: 5.75, pitch: 3.1 * Math.PI / 180 } },
  ring: { camera: { height: 2.4, z: 4.1, pitch: 0.5 * Math.PI / 180 } },
  flat: { camera: { height: 2.0, z: 4.6, pitch: 0.08 } },
  cans: { camera: { height: 2.9, z: 6.05, pitch: 4.6 * Math.PI / 180 } },
  canPyramid: { camera: { x: 1.54, height: 2.06, z: 3.53, yaw: 12.7 * Math.PI / 180, pitch: -1.2 * Math.PI / 180, fov: 72 } },
  brickPile: { camera: { x: 2.58, height: 2.47, z: 2.35, yaw: 30.5 * Math.PI / 180, pitch: -12.9 * Math.PI / 180, fov: 72 } },
  brickPillars: { camera: { height: 1.2, z: 4.6, pitch: 0.08 } },
  desk: { camera: { x: 0, height: 1.65, z: 3.35, yaw: 0, pitch: -4.8 * Math.PI / 180, fov: 72 } },
};

const GROUND_SCENES = new Set(['ring', 'flat', 'canPyramid', 'brickPile', 'brickPillars', 'desk']);

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
const fullBtn = document.getElementById('fullBtn');
const toolWrap = document.getElementById('toolWrap');
const toolBtn = document.getElementById('toolBtn');
const toolItems = [...document.querySelectorAll('.toolItem')];
const toolButtonCanvas = document.getElementById('toolPreview');
const toolItemCanvases = new Map(
  toolItems.map((item) => [item.dataset.projectile, item.querySelector('canvas')]),
);
const debugPanel = document.getElementById('debugPanel');
const debugClose = document.getElementById('debugClose');
const debugFull = document.getElementById('debugFull');
const dbgX = document.getElementById('dbgX');
const dbgY = document.getElementById('dbgY');
const dbgZ = document.getElementById('dbgZ');
const dbgYaw = document.getElementById('dbgYaw');
const dbgPitch = document.getElementById('dbgPitch');
const dbgAll = document.getElementById('dbgAll');
const debugCopy = document.getElementById('debugCopy');

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
const frameMat = new THREE.MeshStandardMaterial({
  color: '#8e959c', map: brickTexture, roughness: 0.85, metalness: 0.05,
});
const projectileBrickMat = new THREE.MeshStandardMaterial({
  color: '#b5533c', map: brickTexture, roughness: 0.9, metalness: 0,
});
const deskWoodMat = new THREE.MeshStandardMaterial({
  color: '#a9794d', roughness: 0.82, metalness: 0,
});
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

const bombMetalMat = new THREE.MeshStandardMaterial({
  color: '#8b9299', metalness: 0.8, roughness: 0.3,
});
const bombGlassMat = new THREE.MeshStandardMaterial({
  color: '#d8f6ed', transparent: true, opacity: 0.24, roughness: 0.08,
  metalness: 0.05, depthWrite: false, side: THREE.DoubleSide,
});
const bombLiquidMat = new THREE.MeshStandardMaterial({
  color: '#43e08a', emissive: '#1e9e5c', emissiveIntensity: 0.9,
  transparent: true, opacity: 0.92, roughness: 0.22,
});
const bombTubeGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.3, 20, 1, true);
const bombLiquidGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.22, 20, 1);
const bombCapGeo = new THREE.CylinderGeometry(0.086, 0.086, 0.022, 20);
const bombRingGeo = new THREE.TorusGeometry(0.09, 0.012, 8, 20);
const bombBarGeo = new THREE.BoxGeometry(0.012, 0.31, 0.012);

function createBombMesh() {
  const group = new THREE.Group();
  const tube = new THREE.Mesh(bombTubeGeo, bombGlassMat);
  group.add(tube);

  const liquid = new THREE.Mesh(bombLiquidGeo, bombLiquidMat);
  group.add(liquid);

  for (const y of [-0.16, 0.16]) {
    const cap = new THREE.Mesh(bombCapGeo, bombMetalMat);
    cap.position.y = y;
    cap.castShadow = true;
    group.add(cap);
    const ring = new THREE.Mesh(bombRingGeo, bombMetalMat);
    ring.position.y = y * 0.86;
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = true;
    group.add(ring);
  }

  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(bombBarGeo, bombMetalMat);
    const a = i * Math.PI / 2 + Math.PI / 4;
    bar.position.set(Math.cos(a) * 0.092, 0, Math.sin(a) * 0.092);
    bar.castShadow = true;
    group.add(bar);
  }
  return group;
}

const toolBallMat = new THREE.MeshStandardMaterial({
  color: '#ff6b57', roughness: 0.42, metalness: 0.05,
});
const previewRenderer = new THREE.WebGLRenderer({
  alpha: true, antialias: true, preserveDrawingBuffer: true,
});
previewRenderer.setPixelRatio(1);
previewRenderer.setSize(128, 128);
previewRenderer.setClearColor(0x000000, 0);

const previewScene = new THREE.Scene();
const previewCamera = new THREE.PerspectiveCamera(32, 1, 0.05, 10);
previewCamera.position.set(0.7, 0.45, 0.95);
previewCamera.lookAt(0, 0.02, 0);
previewScene.add(new THREE.HemisphereLight('#ffffff', '#9db4cc', 2.2));
const previewSun = new THREE.DirectionalLight('#fff3e2', 2.2);
previewSun.position.set(1, 2, 2);
previewScene.add(previewSun);

const previewMeshes = {
  ball: new THREE.Mesh(ballGeo, toolBallMat),
  brick: new THREE.Mesh(brickGeo, projectileBrickMat),
  can: new THREE.Mesh(canGeo, makeCanMaterial()),
  bomb: createBombMesh(),
};
previewMeshes.ball.scale.setScalar(1.25);
for (const mesh of Object.values(previewMeshes)) {
  mesh.visible = false;
  previewScene.add(mesh);
}

function drawToolPreview(type, target, angle) {
  for (const [key, mesh] of Object.entries(previewMeshes)) {
    mesh.visible = key === type;
  }
  const mesh = previewMeshes[type];
  if (type === 'brick') {
    mesh.rotation.set(
      0.25 + Math.sin(angle * 0.9 + 0.4) * 0.6,
      angle * 1.05 + Math.cos(angle * 0.5) * 0.35,
      0.15 + Math.sin(angle * 0.7 + 1.1) * 0.5,
    );
  } else if (type === 'can') {
    mesh.rotation.set(
      0.2 + Math.sin(angle * 0.8 + 2.1) * 0.45,
      angle * 1.15 + Math.sin(angle * 0.45 + 0.7) * 0.5,
      0.25 + Math.cos(angle * 0.65 + 0.2) * 0.4,
    );
  } else if (type === 'bomb') {
    mesh.rotation.set(
      angle * 0.7 + Math.sin(angle * 0.55 + 1.4) * 0.45,
      angle * 1.0 + Math.cos(angle * 0.4 + 0.3) * 0.5,
      angle * 0.5 + Math.sin(angle * 0.65 + 2.2) * 0.4,
    );
  } else {
    mesh.rotation.set(
      angle * 0.9 + Math.sin(angle * 0.6) * 0.4,
      angle * 1.2 + Math.cos(angle * 0.5 + 1) * 0.45,
      Math.sin(angle * 0.75 + 2) * 0.5,
    );
  }
  previewRenderer.render(previewScene, previewCamera);
  const ctx = target.getContext('2d');
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(previewRenderer.domElement, 0, 0, target.width, target.height);
}

function updateToolPreviews(now) {
  const angle = now * 0.0006;
  drawToolPreview(projectileType, toolButtonCanvas, angle);
  if (!toolWrap.classList.contains('open')) return;
  const offsets = { ball: 0, brick: 1.1, can: 2.3, bomb: 3.4 };
  for (const [type, canvas] of toolItemCanvases) {
    drawToolPreview(type, canvas, angle + offsets[type]);
  }
}

const bricks = [];
const staticBricks = [];
const balls = [];
const explosions = [];
const ballColliders = new Map();
const explosionGeo = new THREE.SphereGeometry(0.16, 16, 12);
let towerBounds = null;
let fallenCount = 0;
let throwCount = 0;
let debugCamera = false;
let debugDragging = false;
let debugSaved = null;
let statsPressTimer = null;
const debugKeys = new Set();

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
let projectileType = 'ball';
let bombStrength = 1;
let bombRadius = 2;

const tmpForward = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function aimDirection(out) {
  return out.set(0, 0, -1).applyQuaternion(camera.quaternion);
}

function projectileRadius() {
  if (projectileType === 'brick') return CONFIG.brick.d / 2;
  if (projectileType === 'can') return CONFIG.cans.radius;
  if (projectileType === 'bomb') return 0.16;
  return ballRadius;
}

function launchPoint(out) {
  aimDirection(tmpForward);
  const forward = 0.62 + Math.max(0, projectileRadius() - CONFIG.ball.radius) * 1.4;
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
  targets.push(ground, backWall, ...standMeshes.filter((m) => m.visible), ...staticBricks.map((b) => b.mesh));
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

const PROP_SCALE = 1.5;
const PROP_CENTER_Z = -1.2;

function addDynamicProp(mesh, half, pos, mass) {
  const h = { x: half.x * PROP_SCALE, y: half.y * PROP_SCALE, z: half.z * PROP_SCALE };
  const p = {
    x: pos.x * PROP_SCALE,
    y: pos.y * PROP_SCALE,
    z: PROP_CENTER_Z + (pos.z - PROP_CENTER_Z) * PROP_SCALE,
  };
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(p.x, p.y, p.z)
      .setLinearDamping(0.12)
      .setAngularDamping(0.3),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(h.x, h.y, h.z)
      .setMass(mass)
      .setFriction(0.65)
      .setRestitution(0.12),
    body,
  );
  mesh.scale.setScalar(PROP_SCALE);
  mesh.position.set(p.x, p.y, p.z);
  mesh.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  scene.add(mesh);
  bricks.push({
    body, mesh, fallen: false,
    hx: h.x, hy: h.y, hz: h.z,
    initial: new THREE.Vector3(p.x, p.y, p.z),
  });
}

function addStaticProp(mesh, half, pos) {
  const h = { x: half.x * PROP_SCALE, y: half.y * PROP_SCALE, z: half.z * PROP_SCALE };
  const p = {
    x: pos.x * PROP_SCALE,
    y: pos.y * PROP_SCALE,
    z: PROP_CENTER_Z + (pos.z - PROP_CENTER_Z) * PROP_SCALE,
  };
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.y, p.z),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(h.x, h.y, h.z)
      .setFriction(0.8)
      .setRestitution(0.05),
    body,
  );
  mesh.scale.setScalar(PROP_SCALE);
  mesh.position.set(p.x, p.y, p.z);
  mesh.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  scene.add(mesh);
  staticBricks.push({ body, mesh });
}

function addDynamicCompound(group, parts, pos, mass) {
  const p = {
    x: pos.x * PROP_SCALE,
    y: pos.y * PROP_SCALE,
    z: PROP_CENTER_Z + (pos.z - PROP_CENTER_Z) * PROP_SCALE,
  };
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(p.x, p.y, p.z)
      .setLinearDamping(0.12)
      .setAngularDamping(0.3),
  );
  const partMass = mass / parts.length;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const part of parts) {
    const h = {
      x: part.half.x * PROP_SCALE,
      y: part.half.y * PROP_SCALE,
      z: part.half.z * PROP_SCALE,
    };
    const off = {
      x: part.offset.x * PROP_SCALE,
      y: part.offset.y * PROP_SCALE,
      z: part.offset.z * PROP_SCALE,
    };
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(h.x, h.y, h.z)
        .setTranslation(off.x, off.y, off.z)
        .setMass(partMass)
        .setFriction(0.7)
        .setRestitution(0.08),
      body,
    );
    minX = Math.min(minX, off.x - h.x);
    maxX = Math.max(maxX, off.x + h.x);
    minY = Math.min(minY, off.y - h.y);
    maxY = Math.max(maxY, off.y + h.y);
    minZ = Math.min(minZ, off.z - h.z);
    maxZ = Math.max(maxZ, off.z + h.z);
  }

  group.scale.setScalar(PROP_SCALE);
  group.position.set(p.x, p.y, p.z);
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  scene.add(group);

  bricks.push({
    body, mesh: group, fallen: false,
    hx: (maxX - minX) / 2,
    hy: (maxY - minY) / 2,
    hz: (maxZ - minZ) / 2,
    initial: new THREE.Vector3(p.x, p.y, p.z),
  });
}

function disposeMeshMaterials(mesh) {
  const mats = new Set();
  mesh.traverse((o) => {
    if (!o.isMesh) return;
    if (Array.isArray(o.material)) {
      for (const m of o.material) mats.add(m);
    } else if (o.material) {
      mats.add(o.material);
    }
  });
  for (const m of mats) m.dispose();
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

function createDenseBase(cols = CONFIG.wall.cols) {
  const { w, h, gap } = CONFIG.brick;
  const width = (cols - 1) * (w + gap) + w;
  const step = h + gap;
  const count = Math.floor(width / step);
  const y = CONFIG.stand.height + w / 2 + 0.001;
  for (let i = 0; i < count; i++) {
    createUpright({
      x: (i - (count - 1) / 2) * step,
      y,
      z: CONFIG.targetZ,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    });
  }
}

function createStaticWallBrick({ x, y, z }) {
  const { w, h, d } = CONFIG.brick;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
      .setFriction(0.8)
      .setRestitution(0.05)
      .setCollisionGroups(FIXED_BRICK_COLLISION_GROUPS),
    body,
  );
  const mesh = new THREE.Mesh(brickGeo, frameMat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  staticBricks.push({ body, mesh });
}

function buildFramedWall() {
  const { w, h, gap } = CONFIG.brick;
  const { cols, rows } = CONFIG.framedWall;
  const step = w + gap;
  const baseY = CONFIG.stand.height + w + 0.006;
  const vGap = -0.004;

  for (let r = 0; r < rows; r++) {
    const n = cols - (r % 2);
    for (let c = 0; c < n; c++) {
      const x = (c - (n - 1) / 2) * step;
      const y = baseY + h / 2 + r * (h + vGap);
      if (c === 0 || c === n - 1) {
        createStaticWallBrick({ x, y, z: CONFIG.targetZ });
      } else {
        createBrick({
          x,
          y,
          z: CONFIG.targetZ,
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        });
      }
    }
  }
}

function buildTower({ cols = CONFIG.tower.cols, withCans = false } = {}) {
  const { w, h, gap } = CONFIG.brick;
  const n = cols;
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

    if (withCans) {
      for (let c = 0; c < n; c++) {
        createCan({
          x: (supports[c] + supports[c + 1]) / 2,
          y: bottom + CONFIG.cans.length / 2 + 0.002,
          z: CONFIG.targetZ,
        });
      }
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

function buildTaperTower(withCans = false) {
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

    if (withCans) {
      for (let c = 0; c < n; c++) {
        createCan({
          x: (supports[c] + supports[c + 1]) / 2,
          y: bottom + CONFIG.cans.length / 2 + 0.002,
          z: CONFIG.targetZ,
        });
      }
    }

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

function buildCanPyramid() {
  const { length, spacing } = CONFIG.cans;
  const base = CONFIG.canPyramid.base;
  const baseY = length / 2 + 0.002;

  for (let layer = 0; layer < base; layer++) {
    const n = base - layer;
    const y = baseY + layer * (length + 0.002);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        createCan({
          x: (i - (n - 1) / 2) * spacing,
          y,
          z: CONFIG.targetZ + (j - (n - 1) / 2) * spacing,
        });
      }
    }
  }
}

function createBrickAlongZ(spec) {
  const { w, h, d } = CONFIG.brick;
  const localHalf = { x: w / 2, y: h / 2, z: d / 2 };
  const boundHalf = { x: d / 2, y: h / 2, z: w / 2 };
  const rotation = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
  createBrickBody(spec, localHalf, boundHalf, rotation);
}

function buildBrickPile() {
  const { w, h, d, gap } = CONFIG.brick;
  const { nx, nz, layers } = CONFIG.brickPile;
  const stepX = w + gap;
  const stepZ = d + gap;
  const baseY = h / 2 + 0.002;

  for (let layer = 0; layer < layers; layer++) {
    const y = baseY + layer * (h + gap);
    if (layer % 2 === 0) {
      for (let ix = 0; ix < nx; ix++) {
        for (let iz = 0; iz < nz; iz++) {
          createBrick({
            x: (ix - (nx - 1) / 2) * stepX,
            y,
            z: CONFIG.targetZ + (iz - (nz - 1) / 2) * stepZ,
            color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          });
        }
      }
    } else {
      for (let ix = 0; ix < nz; ix++) {
        for (let iz = 0; iz < nx; iz++) {
          createBrickAlongZ({
            x: (ix - (nz - 1) / 2) * stepZ,
            y,
            z: CONFIG.targetZ + (iz - (nx - 1) / 2) * stepX,
            color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          });
        }
      }
    }
  }
}

function buildBrickPillars() {
  const { w, h, d, gap } = CONFIG.brick;
  const { count, spacing, layers, z: centerZ } = CONFIG.brickPillars;
  const baseY = h / 2 + 0.002;
  const side = (d + gap) / 2;

  for (let p = 0; p < count; p++) {
    const px = (p - (count - 1) / 2) * spacing;
    for (let layer = 0; layer < layers; layer++) {
      const y = baseY + layer * (h + gap);
      if (layer % 2 === 0) {
        for (const dz of [-side, side]) {
          createBrick({
            x: px,
            y,
            z: centerZ + dz,
            color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          });
        }
      } else {
        for (const dx of [-side, side]) {
          createBrickAlongZ({
            x: px + dx,
            y,
            z: centerZ,
            color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          });
        }
      }
    }
  }
}

function buildDeskScene() {
  const dark = new THREE.MeshStandardMaterial({ color: '#30363b', roughness: 0.5, metalness: 0.3 });
  const keyboardMat = new THREE.MeshStandardMaterial({ color: '#454b52', roughness: 0.55 });
  const screenMat = new THREE.MeshStandardMaterial({
    color: '#2f6a8a', emissive: '#123b4f', emissiveIntensity: 0.5, roughness: 0.35,
  });
  const ceramic = new THREE.MeshStandardMaterial({ color: '#e8e3da', roughness: 0.45 });
  const potMat = new THREE.MeshStandardMaterial({ color: '#b86645', roughness: 0.8 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3f8a4e', roughness: 0.7 });
  const bookColors = ['#8b4a3c', '#3e647c', '#6c7b4e', '#8a6a3a', '#5b4a72', '#a04b5e'];

  const desk = new THREE.Group();
  const deskParts = [];
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.7), deskWoodMat);
  desk.add(top);
  deskParts.push({ half: { x: 0.75, y: 0.03, z: 0.35 }, offset: { x: 0, y: 0, z: 0 } });

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.69, 0.06), deskWoodMat);
      leg.position.set(sx * 0.68, -0.375, sz * 0.28);
      desk.add(leg);
      deskParts.push({
        half: { x: 0.03, y: 0.345, z: 0.03 },
        offset: { x: sx * 0.68, y: -0.375, z: sz * 0.28 },
      });
    }
  }
  addDynamicCompound(desk, deskParts, { x: 0, y: 0.72, z: -1.2 }, 8);

  const shelfX = 1.15;
  const shelfZ = -1.7;
  const shelf = new THREE.Group();
  const shelfParts = [];

  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.6, 0.32), deskWoodMat);
    panel.position.set(side * 0.33, 0, 0);
    shelf.add(panel);
    shelfParts.push({
      half: { x: 0.02, y: 0.8, z: 0.16 },
      offset: { x: side * 0.33, y: 0, z: 0 },
    });
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.02), deskWoodMat);
  back.position.z = -0.15;
  shelf.add(back);
  shelfParts.push({
    half: { x: 0.35, y: 0.8, z: 0.01 },
    offset: { x: 0, y: 0, z: -0.15 },
  });

  const shelfYs = [0.04, 0.3, 0.75, 1.2, 1.55];
  for (const y of shelfYs) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.3), deskWoodMat);
    board.position.y = y - 0.8;
    shelf.add(board);
    shelfParts.push({
      half: { x: 0.35, y: 0.015, z: 0.15 },
      offset: { x: 0, y: y - 0.8, z: 0 },
    });
  }
  addDynamicCompound(shelf, shelfParts, { x: shelfX, y: 0.8, z: shelfZ }, 12);

  const monitor = new THREE.Group();
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.34, 0.04), dark);
  screen.position.y = 0.095;
  const display = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.26, 0.006), screenMat);
  display.position.set(0, 0.095, 0.023);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), dark);
  stand.position.y = -0.165;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.14), dark);
  base.position.y = -0.255;
  monitor.add(screen, display, stand, base);
  addDynamicProp(monitor, { x: 0.28, y: 0.265, z: 0.08 }, {
    x: -0.25, y: 1.015, z: -1.35,
  }, 2);

  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.45), dark);
  addDynamicProp(tower, { x: 0.1, y: 0.225, z: 0.225 }, {
    x: -0.95, y: 0.227, z: -1.2,
  }, 5);

  const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.14), keyboardMat);
  addDynamicProp(keyboard, { x: 0.21, y: 0.015, z: 0.07 }, {
    x: -0.25, y: 0.765, z: -1.02,
  }, 0.5);

  const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.1), keyboardMat);
  addDynamicProp(mouse, { x: 0.035, y: 0.02, z: 0.05 }, {
    x: 0.1, y: 0.77, z: -1.02,
  }, 0.15);

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.12, 16), ceramic);
  addDynamicProp(cup, { x: 0.045, y: 0.06, z: 0.045 }, {
    x: 0.42, y: 0.81, z: -1.15,
  }, 0.2);

  const plant = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.12, 12), potMat);
  pot.position.y = -0.14;
  plant.add(pot);
  const leafGeo = new THREE.SphereGeometry(0.075, 10, 8);
  for (const [dx, dy, dz] of [[0, 0.02, 0], [0.06, -0.02, 0.03], [-0.05, -0.03, -0.04]]) {
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(dx, dy, dz);
    plant.add(leaf);
  }
  addDynamicProp(plant, { x: 0.12, y: 0.2, z: 0.12 }, {
    x: 0.6, y: 0.95, z: -1.35,
  }, 0.6);

  const addBook = (x, y, z, w, d, color, mass) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.035, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    addDynamicProp(mesh, { x: w / 2, y: 0.0175, z: d / 2 }, { x, y, z }, mass);
  };

  addBook(-0.62, 0.768, -1.4, 0.22, 0.16, bookColors[0], 0.3);
  addBook(-0.61, 0.803, -1.4, 0.22, 0.16, bookColors[1], 0.3);
  addBook(-0.62, 0.838, -1.4, 0.22, 0.16, bookColors[2], 0.3);

  const addUprightBook = (x, bottom, z, thickness, height, depth, color) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(thickness, height, depth),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    addDynamicProp(
      mesh,
      { x: thickness / 2, y: height / 2, z: depth / 2 },
      { x, y: bottom + height / 2, z },
      0.12,
    );
  };

  for (let i = 0; i < shelfYs.length - 1; i++) {
    const bottom = shelfYs[i] + 0.015;
    const maxHeight = shelfYs[i + 1] - 0.015 - bottom - 0.01;
    let x = -0.29;
    for (let b = 0; b < 14; b++) {
      const thickness = 0.022 + Math.random() * 0.012;
      if (x + thickness > 0.29) break;
      const height = Math.min(maxHeight, 0.18 + Math.random() * 0.12);
      addUprightBook(
        shelfX + x + thickness / 2,
        bottom,
        shelfZ,
        thickness,
        height,
        0.14,
        bookColors[(i * 14 + b) % bookColors.length],
      );
      x += thickness + 0.003;
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
    disposeMeshMaterials(b.mesh);
  }
  bricks.length = 0;
  for (const b of staticBricks) {
    world.removeRigidBody(b.body);
    scene.remove(b.mesh);
  }
  staticBricks.length = 0;
}

function spawnBricks() {
  clearBricks();
  if (currentScene === 'tower') {
    buildTower();
  } else if (currentScene === 'towerCans') {
    buildTower({ cols: CONFIG.towerCans.cols, withCans: true });
  } else if (currentScene === 'taper') {
    buildTaperTower();
  } else if (currentScene === 'taperCans') {
    buildTaperTower(true);
  } else if (currentScene === 'ring') {
    buildRingTower();
  } else if (currentScene === 'flat') {
    buildFlatRing();
  } else if (currentScene === 'cans') {
    buildCanTower();
  } else if (currentScene === 'canPyramid') {
    buildCanPyramid();
  } else if (currentScene === 'brickPile') {
    buildBrickPile();
  } else if (currentScene === 'brickPillars') {
    buildBrickPillars();
  } else if (currentScene === 'desk') {
    buildDeskScene();
  } else if (currentScene === 'framedWall') {
    buildFramedWall();
    createDenseBase(CONFIG.framedWall.cols - 2);
  } else {
    for (const spec of buildLayout()) createBrick(spec);
    if (CONFIG.layout === 'wall' && CONFIG.wall.soldierBase) createDenseBase();
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

function spawnExplosion(pos) {
  const mat = new THREE.MeshBasicMaterial({
    color: '#7dffb0', transparent: true, opacity: 0.75,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(explosionGeo, mat);
  mesh.position.copy(pos);
  mesh.scale.setScalar(0.4);
  scene.add(mesh);
  explosions.push({ mesh, age: 0 });
  spawnParticles(pos, 18);
}

function explodeBomb(bomb) {
  const t = bomb.body.translation();
  const pos = new THREE.Vector3(t.x, t.y, t.z);
  removeBall(bomb);
  spawnExplosion(pos);

  const radius = bombRadius;
  for (const b of bricks) {
    const p = b.body.translation();
    const dx = p.x - pos.x;
    const dy = p.y - pos.y;
    const dz = p.z - pos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > radius || dist < 1e-4) continue;
    const strength = 3.2 * bombStrength * (1 - dist / radius);
    b.body.applyImpulse({
      x: dx / dist * strength,
      y: dy / dist * strength + strength * 0.15,
      z: dz / dist * strength,
    }, true);
  }
}

function updateExplosions(dt) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const e = explosions[i];
    e.age += dt;
    const t = Math.min(1, e.age / 0.45);
    e.mesh.scale.setScalar(0.4 + t * 5);
    e.mesh.material.opacity = 0.75 * (1 - t);
    if (e.age >= 0.45) {
      scene.remove(e.mesh);
      e.mesh.material.dispose();
      explosions.splice(i, 1);
    }
  }
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

  if (projectileType !== 'ball') {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 0.6,
    ));
    bodyDesc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
  }
  const body = world.createRigidBody(bodyDesc);

  let colliderDesc;
  let mesh;
  if (projectileType === 'brick') {
    const { w, h, d, mass } = CONFIG.brick;
    colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
      .setMass(mass)
      .setFriction(0.6)
      .setRestitution(0.1);
    mesh = new THREE.Mesh(brickGeo, projectileBrickMat);
  } else if (projectileType === 'can') {
    const { radius, length, mass } = CONFIG.cans;
    colliderDesc = RAPIER.ColliderDesc.cylinder(length / 2, radius)
      .setMass(mass)
      .setFriction(0.5)
      .setRestitution(0.18);
    mesh = new THREE.Mesh(canGeo, makeCanMaterial());
  } else if (projectileType === 'bomb') {
    colliderDesc = RAPIER.ColliderDesc.cylinder(0.16, 0.09)
      .setMass(0.5)
      .setFriction(0.45)
      .setRestitution(0.1);
    mesh = createBombMesh();
  } else {
    const scale = ballRadius / CONFIG.ball.radius;
    const mass = CONFIG.ball.mass * scale * scale * scale;
    colliderDesc = RAPIER.ColliderDesc.ball(ballRadius)
      .setMass(mass)
      .setFriction(0.42)
      .setRestitution(0.34);
    mesh = new THREE.Mesh(ballGeo, ballMat);
    mesh.scale.setScalar(scale);
  }

  colliderDesc
    .setCollisionGroups(projectileType === 'bomb' ? BOMB_COLLISION_GROUPS : BALL_COLLISION_GROUPS)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
  const collider = world.createCollider(colliderDesc, body);

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const ball = {
    body, mesh, handle: collider.handle,
    age: 0, lastImpact: 0,
    explosive: projectileType === 'bomb',
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
  for (const b of staticBricks) {
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
    if (ball.explosive) {
      explodeBomb(ball);
      return;
    }
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
  if (!ready || !started || debugCamera || charging) return;
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
  if (debugCamera) exitDebugCamera();
  cancelCharge();
  clearBalls();
  spawnBricks();
  throwCount = 0;
  throwsEl.textContent = '0';
}

function applyCamera(spec) {
  camera.position.set(spec.x ?? 0, spec.height, spec.z);
  camera.rotation.y = spec.yaw ?? 0;
  camera.rotation.x = spec.pitch;
  camera.fov = spec.fov ?? CONFIG.camera.fov;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

function updateDebugFields() {
  const x = Number(camera.position.x.toFixed(2));
  const y = Number(camera.position.y.toFixed(2));
  const z = Number(camera.position.z.toFixed(2));
  const yaw = Number(THREE.MathUtils.radToDeg(camera.rotation.y).toFixed(1));
  const pitch = Number(THREE.MathUtils.radToDeg(camera.rotation.x).toFixed(1));
  dbgX.value = x.toFixed(2);
  dbgY.value = y.toFixed(2);
  dbgZ.value = z.toFixed(2);
  dbgYaw.value = yaw.toFixed(1);
  dbgPitch.value = pitch.toFixed(1);
  const all = JSON.stringify({ x, y, z, yaw, pitch, fov: camera.fov });
  if (dbgAll.value !== all) dbgAll.value = all;
}

function enterDebugCamera() {
  if (!started || debugCamera) return;
  debugCamera = true;
  debugSaved = {
    position: camera.position.clone(),
    rotation: camera.rotation.clone(),
    fov: camera.fov,
  };
  cancelCharge();
  aimRing.visible = false;
  previewGeo.setDrawRange(0, 0);
  debugPanel.hidden = false;
  document.body.classList.add('debugging');
  updateDebugFields();
}

function exitDebugCamera() {
  if (!debugCamera) return;
  debugCamera = false;
  debugDragging = false;
  debugKeys.clear();
  debugPanel.hidden = true;
  document.body.classList.remove('debugging');
  if (debugSaved) {
    camera.position.copy(debugSaved.position);
    camera.rotation.copy(debugSaved.rotation);
    camera.fov = debugSaved.fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    debugSaved = null;
  }
}

function updateDebugCamera(dt) {
  const yaw = camera.rotation.y;
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const move = new THREE.Vector3();

  if (debugKeys.has('KeyW')) move.add(forward);
  if (debugKeys.has('KeyS')) move.sub(forward);
  if (debugKeys.has('KeyD')) move.add(right);
  if (debugKeys.has('KeyA')) move.sub(right);
  if (debugKeys.has('Space')) move.y += 1;
  if (debugKeys.has('ShiftLeft') || debugKeys.has('ShiftRight')) move.y -= 1;

  if (move.lengthSq() > 0) {
    camera.position.addScaledVector(move.normalize(), 3 * dt);
    camera.updateMatrixWorld();
  }
  updateDebugFields();
}

function goHome() {
  if (!started) return;
  if (debugCamera) exitDebugCamera();
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

function updateSizeControl() {
  const t = Number(sizeSlider.value) / 1000;
  const diameterCm = 16 * Math.pow(200 / 16, t);
  ballRadius = diameterCm / 200;
  bombStrength = 0.5 + t * 2;
  bombRadius = 1.5 + t * 1.5;
  sizeLabel.textContent = projectileType === 'bomb'
    ? `${Math.round(t * 100)}`
    : `${Math.round(diameterCm)}`;
}

sizeSlider.addEventListener('input', updateSizeControl);
updateSizeControl();

function setProjectile(type) {
  projectileType = type;
  for (const item of toolItems) {
    item.classList.toggle('active', item.dataset.projectile === type);
  }
  updateSizeControl();
}

toolBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  toolWrap.classList.toggle('open');
});

for (const item of toolItems) {
  item.addEventListener('click', () => {
    setProjectile(item.dataset.projectile);
    toolWrap.classList.remove('open');
  });
}

document.addEventListener('pointerdown', (event) => {
  if (!toolWrap.contains(event.target)) toolWrap.classList.remove('open');
});

function updateFullscreenButtons() {
  const label = document.fullscreenElement ? '退出全屏' : '全屏';
  fullBtn.textContent = label;
  debugFull.textContent = label;
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch (err) {
    console.error(err);
  }
}

if (!document.documentElement.requestFullscreen) {
  fullBtn.hidden = true;
  debugFull.hidden = true;
} else {
  fullBtn.addEventListener('click', toggleFullscreen);
  debugFull.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFullscreenButtons);
  updateFullscreenButtons();
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  try {
    renderer.domElement.setPointerCapture(e.pointerId);
  } catch {}
  if (debugCamera) {
    debugDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    return;
  }
  beginCharge(e.clientX, e.clientY);
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!started || !e.isPrimary) return;
  if (debugCamera) {
    if (!debugDragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    camera.rotation.y -= dx * 0.003;
    camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x - dy * 0.003));
    camera.updateMatrixWorld();
    updateDebugFields();
    return;
  }
  if (e.pointerType === 'touch' && !charging) return;
  updateAimFromScreen(e.clientX, e.clientY);
});

window.addEventListener('pointerup', (e) => {
  if (!e.isPrimary) return;
  if (debugCamera) {
    debugDragging = false;
    return;
  }
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  endCharge();
});

window.addEventListener('pointercancel', (e) => {
  if (!e.isPrimary) return;
  if (debugCamera) {
    debugDragging = false;
    return;
  }
  cancelCharge();
});

statsWrap.addEventListener('pointerdown', () => {
  if (!started) return;
  if (statsPressTimer) clearTimeout(statsPressTimer);
  statsPressTimer = setTimeout(() => {
    statsPressTimer = null;
    if (debugCamera) exitDebugCamera();
    else enterDebugCamera();
  }, 600);
});

for (const eventName of ['pointerup', 'pointercancel', 'pointerleave']) {
  statsWrap.addEventListener(eventName, () => {
    if (statsPressTimer) {
      clearTimeout(statsPressTimer);
      statsPressTimer = null;
    }
  });
}

debugClose.addEventListener('click', exitDebugCamera);
dbgAll.addEventListener('click', () => dbgAll.select());

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

debugCopy.addEventListener('click', async () => {
  if (!dbgAll.value) return;
  const ok = await copyText(dbgAll.value);
  debugCopy.textContent = ok ? '已复制' : '失败';
  setTimeout(() => {
    debugCopy.textContent = '复制';
  }, 900);
});

const debugMoveButtons = [...document.querySelectorAll('.debugMoveBtn')];
for (const button of debugMoveButtons) {
  const code = button.dataset.key;
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    debugKeys.add(code);
  });
  const release = () => debugKeys.delete(code);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
}

document.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r') resetGame();
});

window.addEventListener('keydown', (e) => {
  if (!debugCamera) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
    debugKeys.add(e.code);
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  debugKeys.delete(e.code);
});

window.addEventListener('blur', () => {
  debugKeys.clear();
  cancelCharge();
});

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
  if (debugCamera) updateDebugCamera(dt);
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
    updateExplosions(dt);
  }

  updatePreview();
  renderer.render(scene, camera);
  updateToolPreviews(now);
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
        .setRestitution(0.04)
        .setCollisionGroups(STAND_COLLISION_GROUPS),
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
          .setRestitution(0.04)
          .setCollisionGroups(STAND_COLLISION_GROUPS),
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

import * as THREE from 'three';
import RAPIER from '../vendor/rapier.js';

const CONFIG = {
  layout: 'pyramid',
  pyramid: { base: 4, layers: 4 },
  wall: { cols: 7, rows: 5 },
  brick: { w: 0.8, h: 0.34, d: 0.4, gap: 0.012, mass: 1.1 },
  ball: { radius: 0.16, mass: 4, minSpeed: 15, maxSpeed: 32, chargeTime: 1.0 },
  camera: { height: 1.62, z: 4.6, fov: 72, pitch: -0.11 },
  targetZ: -1.9,
  maxBalls: 14,
  ballLife: 9,
};

const PALETTE = ['#7aa7e0', '#7ec8b0', '#ffc857', '#ff8c69', '#9b8cff'];

const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const ovTitle = document.getElementById('ovTitle');
const ovDesc = document.getElementById('ovDesc');
const powerWrap = document.getElementById('powerWrap');
const powerFill = document.getElementById('powerFill');
const powerPct = document.getElementById('powerPct');
const fallenEl = document.getElementById('fallen');
const totalEl = document.getElementById('total');
const throwsEl = document.getElementById('throws');
const resetBtn = document.getElementById('resetBtn');

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

const brickGeo = new THREE.BoxGeometry(CONFIG.brick.w, CONFIG.brick.h, CONFIG.brick.d);
const ballGeo = new THREE.SphereGeometry(CONFIG.ball.radius, 24, 18);
const ballMat = new THREE.MeshStandardMaterial({
  color: '#ff6b57', roughness: 0.4, metalness: 0.05,
});

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
let charging = false;
let chargeStart = 0;
let power = 0;

const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function aimDirection(out) {
  return out.set(0, 0, -1).applyQuaternion(camera.quaternion);
}

function launchPoint(out) {
  aimDirection(tmpForward);
  tmpRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
  return out.copy(camera.position)
    .addScaledVector(tmpForward, 0.62)
    .addScaledVector(tmpRight, 0.16)
    .addScaledVector(UP, -0.14);
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
  targets.push(ground);
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

  if (CONFIG.layout === 'wall') {
    const { cols, rows } = CONFIG.wall;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        layout.push({
          x: (c - (cols - 1) / 2) * (w + gap),
          y: h / 2 + r * (h + gap),
          z: z0,
          color: PALETTE[r % PALETTE.length],
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
          y: h / 2 + layer * (h + gap),
          z: z0 + (j - (n - 1) / 2) * (d + gap),
          color: PALETTE[layer % PALETTE.length],
        });
      }
    }
  }
  return layout;
}

function createBrick({ x, y, z, color }) {
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y, z)
    .setLinearDamping(0.12)
    .setAngularDamping(0.35);
  const body = world.createRigidBody(bodyDesc);

  const colliderDesc = RAPIER.ColliderDesc.cuboid(
    CONFIG.brick.w / 2, CONFIG.brick.h / 2, CONFIG.brick.d / 2,
  )
    .setMass(CONFIG.brick.mass)
    .setFriction(0.78)
    .setRestitution(0.04);
  world.createCollider(colliderDesc, body);

  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.62, metalness: 0.02,
  });
  mat.color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.045);
  const mesh = new THREE.Mesh(brickGeo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const brick = {
    body, mesh, fallen: false,
    initial: new THREE.Vector3(x, y, z),
  };
  bricks.push(brick);
}

function computeTowerBounds() {
  const hx = CONFIG.brick.w / 2;
  const hy = CONFIG.brick.h / 2;
  const hz = CONFIG.brick.d / 2;
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const b of bricks) {
    const t = b.body.translation();
    min.x = Math.min(min.x, t.x - hx);
    min.y = Math.min(min.y, t.y - hy);
    min.z = Math.min(min.z, t.z - hz);
    max.x = Math.max(max.x, t.x + hx);
    max.y = Math.max(max.y, t.y + hy);
    max.z = Math.max(max.z, t.z + hz);
  }
  towerBounds = bricks.length ? { min, max } : null;
}

function settle() {
  for (let i = 0; i < 45; i++) world.step();
  for (const b of bricks) {
    const t = b.body.translation();
    b.initial.set(t.x, t.y, t.z);
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
  for (const spec of buildLayout()) createBrick(spec);
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

  const colliderDesc = RAPIER.ColliderDesc.ball(CONFIG.ball.radius)
    .setMass(CONFIG.ball.mass)
    .setFriction(0.42)
    .setRestitution(0.34)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
  const collider = world.createCollider(colliderDesc, body);

  const mesh = new THREE.Mesh(ballGeo, ballMat);
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
    const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
    const dx = t.x - b.initial.x;
    const dy = t.y - b.initial.y;
    const dz = t.z - b.initial.z;
    if (dx * dx + dy * dy + dz * dz > 0.05 || upY < 0.8) {
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

function startGame(clientX, clientY) {
  if (!ready || started) return;
  started = true;
  overlay.classList.add('hidden');
  document.body.classList.add('playing');
  updateAimFromScreen(clientX, clientY);
}

overlay.addEventListener('click', (e) => startGame(e.clientX, e.clientY));

resetBtn.addEventListener('click', () => {
  resetBtn.blur();
  resetGame();
});

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
    eventQueue = new RAPIER.EventQueue(true);

    const groundBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(45, 0.5, 45).setFriction(0.9).setRestitution(0.05),
      groundBody,
    );

    spawnBricks();
    ready = true;
    startBtn.textContent = '开始拆塔';
    animate();
  } catch (err) {
    console.error(err);
    ovTitle.textContent = '加载失败';
    ovDesc.textContent = '物理引擎初始化失败，请通过本地 HTTP 服务打开本页（见 README）。';
    startBtn.style.display = 'none';
  }
}

startBtn.textContent = '加载中…';
boot();

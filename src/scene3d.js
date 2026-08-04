import * as THREE from 'three';
import { WALLS } from './world.js';

let scene, camera, renderer, container;
const meshes = new Map();
let sky;

function mesh(kind) {
  const colors = {
    pacman: 0xffd800,
    invader: 0xff3344,
    pellet: 0xffffcc,
    'power-pellet': 0xffffff,
    projectile: 0x00ffff
  };

  const geometry =
    kind === 'invader'
      ? new THREE.BoxGeometry(0.8, 0.7, 0.5)
      : kind === 'projectile'
        ? new THREE.CapsuleGeometry(0.07, 0.25, 3, 6)
        : new THREE.SphereGeometry(kind?.includes('pellet') ? 0.13 : 0.35, 12, 8);

  // Keep entity material changes subtle (avoid breaking readability for FPS/HUD).
  const base = colors[kind] ?? 0xffffff;
  const mat = new THREE.MeshStandardMaterial({
    color: base,
    emissive: base,
    emissiveIntensity: 0.12,
    roughness: 0.55,
    metalness: 0.05
  });

  return new THREE.Mesh(geometry, mat);
}

function addSky() {
  if (!scene) return;
  if (sky) scene.remove(sky);

  // Lightweight gradient sky dome (no external assets).
  const geo = new THREE.SphereGeometry(80, 32, 16);
  geo.scale(-1, 1, 1);

  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x7fb7ff) },
      bottomColor: { value: new THREE.Color(0x06070d) },
      offset: { value: 20.0 },
      exponent: { value: 0.6 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        float t = pow(max(h, 0.0), exponent);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `
  });

  sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  scene.add(sky);
}

function getEntityY(e) {
  const pos = e.position ?? {};
  const y = Number(pos.y);

  // New contract: use finite position.y when provided (aerial entities).
  if (Number.isFinite(y)) return y;

  // Legacy fallback: preserve baseline heights.
  return e.kind?.includes('pellet') ? 0.18 : 0.45;
}

export function initScene(target = '#game') {
  container = typeof target === 'string' ? document.querySelector(target) : target;
  if (!container) throw Error('Scene container not found');

  scene = new THREE.Scene();

  // Background now comes from gradient sky dome.
  scene.background = null;

  // Slightly longer fog for depth without hurting gameplay visibility.
  scene.fog = new THREE.Fog(0x0a0d14, 14, 38);

  camera = new THREE.PerspectiveCamera(70, 1, 0.05, 140);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.physicallyCorrectLights = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.append(renderer.domElement);

  addSky();

  // Lighting: coherent key (sun) + gentle fill.
  scene.add(new THREE.HemisphereLight(0xd5e6ff, 0x0b0c14, 1.2));

  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(6, 10, 2);
  scene.add(sun);

  // Ground.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 18),
    new THREE.MeshStandardMaterial({
      color: 0x0b1022,
      roughness: 0.9,
      metalness: 0.0
    })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Walls.
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x204a78,
    emissive: 0x061221,
    emissiveIntensity: 0.35,
    roughness: 0.55,
    metalness: 0.02
  });

  for (const w of WALLS) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w.w, 1.4, w.d), wallMaterial);
    m.position.set(w.x, 0.7, w.z);
    scene.add(m);
  }

  const resize = () => {
    camera.aspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight, false);
  };

  resize();
  new ResizeObserver(resize).observe(container);

  const loop = () => {
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return { scene, camera, renderer };
}

export function setFirstPersonView(position, yaw, pitch) {
  if (!camera) return;
  camera.position.set(position.x, 1.05, position.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.set(pitch, yaw, 0);
}

export function syncScene(state) {
  if (!scene) return;
  const present = new Set();

  for (const [id, e] of state.entities) {
    if (e.active === false || id === 'pacman') continue;
    present.add(id);

    let m = meshes.get(id);
    if (!m) {
      m = mesh(e.kind);
      meshes.set(id, m);
      scene.add(m);
    }

    m.position.set(e.position.x, getEntityY(e), e.position.z);
  }

  for (const [id, m] of meshes) {
    if (!present.has(id)) {
      scene.remove(m);
      meshes.delete(id);
    }
  }
}

export function renderFrame() {
  if (renderer) renderer.render(scene, camera);
}

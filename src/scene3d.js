import * as THREE from 'three';

let scene, camera, renderer, container, resizeObserver, animationFrame;
const entityMeshes = new Map();

function invader(color = 0xff3344) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65), material);
  body.scale.z = 0.7;
  group.add(body);
  for (const x of [-0.26, 0.26]) {
    const leg = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 8), material);
    leg.position.set(x, -0.28, 0);
    group.add(leg);
  }
  return group;
}

const factories = {
  pacman: () => new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 24, 16, 0.35, Math.PI * 1.78),
    new THREE.MeshStandardMaterial({ color: 0xffd800, roughness: 0.55 }),
  ),
  ghost: () => invader(),
  invader: () => invader(),
  pellet: () => new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0x554422, emissiveIntensity: 0.4 }),
  ),
  'power-pellet': () => new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xaaaaff, emissiveIntensity: 0.8 }),
  ),
  projectile: () => new THREE.Mesh(
    new THREE.CapsuleGeometry(0.08, 0.3, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x0088aa, emissiveIntensity: 0.7 }),
  ),
  wall: () => new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.8, 1),
    new THREE.MeshStandardMaterial({ color: 0x183399, roughness: 0.7 }),
  ),
};

function addArena() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 16, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0x040412, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const material = new THREE.MeshStandardMaterial({ color: 0x1239b8, emissive: 0x051444, roughness: 0.7 });
  const walls = [
    [0, -8, 20, 1], [0, 8, 20, 1], [-10, 0, 1, 16], [10, 0, 1, 16],
    [-5, -3, 6, 0.6], [5, 3, 6, 0.6], [0, -5.5, 0.6, 5], [0, 5.5, 0.6, 5],
  ];
  for (const [x, z, width, depth] of walls) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, 1, depth), material);
    wall.position.set(x, 0.5, z);
    scene.add(wall);
  }
}

function resize() {
  if (!renderer || !camera || !container) return;
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

/** Initializes the Three.js view and its render loop. Gameplay remains an external concern. */
export function initScene(target = '#game') {
  container = typeof target === 'string' ? document.querySelector(target) : target;
  if (!container) throw new Error('Scene container not found');
  if (animationFrame) cancelAnimationFrame(animationFrame);
  resizeObserver?.disconnect();
  renderer?.domElement.remove();
  renderer?.dispose();
  entityMeshes.clear();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020208);
  scene.fog = new THREE.Fog(0x020208, 14, 32);
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 16.5, 12.5);
  camera.lookAt(0, 0, -0.5);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.append(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xccddff, 0x101020, 2.2));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(4, 10, 6);
  scene.add(light);
  addArena();
  resize();
  resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  resizeObserver?.observe(container);

  const loop = (time) => {
    renderFrame(time);
    animationFrame = requestAnimationFrame(loop);
  };
  animationFrame = requestAnimationFrame(loop);
  return { scene, camera, renderer };
}

function entriesOf(entities) {
  if (entities instanceof Map) return entities.entries();
  if (Array.isArray(entities)) return entities.map((entity, index) => [entity.id ?? String(index), entity]);
  return Object.entries(entities ?? {});
}

/** Synchronizes visual entities without mutating gameplay state. */
export function syncScene(gameState) {
  if (!scene) return;
  const present = new Set();
  for (const [rawId, entity] of entriesOf(gameState?.entities)) {
    if (!entity || entity.active === false) continue;
    const id = String(rawId);
    const kind = entity.kind ?? entity.type;
    const factory = factories[kind];
    if (!factory) continue;
    present.add(id);
    let mesh = entityMeshes.get(id);
    if (!mesh || mesh.userData.kind !== kind) {
      if (mesh) scene.remove(mesh);
      mesh = factory();
      mesh.userData.kind = kind;
      entityMeshes.set(id, mesh);
      scene.add(mesh);
    }
    const position = entity.position ?? entity;
    const worldZ = position.z ?? (entity.position ? 0 : position.y) ?? 0;
    mesh.position.set(position.x ?? 0, (position.y ?? 0) + (kind === 'wall' ? 0.4 : 0.45), worldZ);
    const velocity = entity.velocity;
    if (velocity && (velocity.x || velocity.z)) mesh.rotation.y = Math.atan2(velocity.x, velocity.z);
  }
  for (const [id, mesh] of entityMeshes) {
    if (!present.has(id)) {
      scene.remove(mesh);
      entityMeshes.delete(id);
    }
  }
}

/** Renders one frame; public so a host may also drive rendering explicitly. */
export function renderFrame(time = performance.now()) {
  if (!renderer || !scene || !camera) return;
  for (const mesh of entityMeshes.values()) {
    if (mesh.userData.kind === 'projectile') mesh.rotation.y = time * 0.006;
    if (mesh.userData.kind === 'power-pellet') {
      const scale = 1 + Math.sin(time * 0.006) * 0.12;
      mesh.scale.setScalar(scale);
    }
  }
  renderer.render(scene, camera);
}

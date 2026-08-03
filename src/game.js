import * as THREE from 'three';
import { createGameEventBus, createInitialGameState } from './contracts.js';

const container = document.querySelector('#game');
const status = document.querySelector('#status');
const state = createInitialGameState();
const events = createGameEventBus();

function createRenderer() {
  let renderer;
  let scene;
  let camera;
  let demoMesh;

  return {
    initialize(target) {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x050510);
      camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.set(0, 4, 8);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      target.append(renderer.domElement);

      demoMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 32, 16, 0.25, Math.PI * 1.75),
        new THREE.MeshStandardMaterial({ color: 0xffd800 }),
      );
      scene.add(demoMesh);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x223366, 3));
      this.resize();
    },
    render(gameState) {
      demoMesh.rotation.y = gameState.elapsedMs / 700;
      renderer.render(scene, camera);
    },
    resize() {
      if (!renderer || !camera) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    },
    dispose() {
      renderer?.dispose();
      renderer?.domElement.remove();
    },
  };
}

async function bootstrap() {
  const gameRenderer = createRenderer();
  await gameRenderer.initialize(container, state);
  window.addEventListener('resize', () => gameRenderer.resize());

  state.phase = 'ready';
  status.textContent = 'Ready';
  events.emit({ type: 'game:ready', timestamp: performance.now(), payload: {} });

  // Browser automation and downstream integrations rely on this exact signal.
  window.__GAME_READY__ = true;

  let previous = performance.now();
  function frame(now) {
    state.elapsedMs += now - previous;
    previous = now;
    gameRenderer.render(state);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

bootstrap().catch((error) => {
  status.textContent = 'Initialization failed';
  throw error;
});

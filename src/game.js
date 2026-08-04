import { createGameplay, GAME_STATES, COLLISIONS } from './gameplay.js';
import { createInputController } from './input.js';
import { initScene, syncScene } from './scene3d.js';
import { createHUD } from './hud.js';

const gameRoot = document.querySelector('#game');
const statusNode = document.querySelector('#status');
const touchRoot = document.querySelector('#touch-controls');
const PELLET_COUNT = 30;
const gameplay = createGameplay({ lives: 3, levels: [{ pellets: PELLET_COUNT }] });
const hud = createHUD({ container: document.body });
let entities;
let player;
let shotClock = 0;
let hitCooldown = 0;

function resetWorld() {
  entities = new Map();
  player = { id: 'pacman', kind: 'pacman', position: { x: 0, z: 6 }, velocity: { x: 0, z: 0 } };
  entities.set(player.id, player);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const id = `invader-${row}-${col}`;
      entities.set(id, { id, kind: 'invader', position: { x: (col - 2) * 2.2, z: -6 + row * 1.4 }, velocity: { x: row % 2 ? -0.45 : 0.45, z: 0 } });
    }
  }
  let n = 0;
  for (let z = -3.5; z <= 5; z += 1.7) {
    for (let x = -7.5; x <= 7.5 && n < PELLET_COUNT; x += 3) {
      const id = `pellet-${n++}`;
      entities.set(id, { id, kind: n % 10 === 0 ? 'power-pellet' : 'pellet', position: { x, z } });
    }
  }
}

function snapshot() {
  return { ...gameplay.getState(), pelletsTotal: PELLET_COUNT, entities };
}
function draw() {
  const state = snapshot();
  syncScene(state);
  hud.updateHUD(state);
  statusNode.textContent = state.status === GAME_STATES.START ? 'Press Enter, move, or tap to start' : '';
}
function startIfNeeded() {
  if (gameplay.getState().status === GAME_STATES.START) gameplay.start();
}
function restart() {
  gameplay.restart();
  resetWorld();
  shotClock = 0;
  hitCooldown = 0;
  draw();
}

const input = createInputController({
  touchRoot,
  onAction({ action, active }) {
    if (!active) return;
    if (action.startsWith('move-')) startIfNeeded();
    if (action === 'pause') {
      const state = gameplay.getState();
      if (state.status === GAME_STATES.START) gameplay.start();
      else gameplay.dispatch('TOGGLE_PAUSE');
    }
    if (action === 'restart') restart();
    draw();
  },
});

function distance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function simulate(deltaMs) {
  const state = gameplay.getState();
  if (state.status !== GAME_STATES.PLAYING) return;
  gameplay.update(deltaMs);
  const dt = Math.min(deltaMs, 50) / 1000;
  const direction = input.getDirection();
  const magnitude = Math.hypot(direction.x, direction.z) || 1;
  player.velocity.x = (direction.x / magnitude) * 6;
  player.velocity.z = (direction.z / magnitude) * 6;
  player.position.x = Math.max(-9, Math.min(9, player.position.x + player.velocity.x * dt));
  player.position.z = Math.max(-7, Math.min(7, player.position.z + player.velocity.z * dt));

  for (const entity of [...entities.values()]) {
    if (entity.kind === 'pellet' || entity.kind === 'power-pellet') {
      if (distance(player.position, entity.position) < .65) {
        entities.delete(entity.id);
        gameplay.collide({ type: entity.kind === 'power-pellet' ? COLLISIONS.POWER_PELLET : COLLISIONS.PELLET });
      }
    } else if (entity.kind === 'invader') {
      entity.position.x += entity.velocity.x * dt;
      if (Math.abs(entity.position.x) > 8.5) entity.velocity.x *= -1;
      if (hitCooldown <= 0 && distance(player.position, entity.position) < .8) loseLife();
    } else if (entity.kind === 'projectile') {
      entity.position.z += entity.velocity.z * dt;
      if (entity.position.z > 8) entities.delete(entity.id);
      else if (hitCooldown <= 0 && distance(player.position, entity.position) < .6) {
        entities.delete(entity.id);
        loseLife();
      }
    }
  }
  hitCooldown = Math.max(0, hitCooldown - deltaMs);
  shotClock += deltaMs;
  if (shotClock > 900) {
    shotClock = 0;
    const invaders = [...entities.values()].filter((entity) => entity.kind === 'invader');
    const source = invaders[Math.floor(Math.random() * invaders.length)];
    if (source) {
      const id = `shot-${performance.now()}`;
      entities.set(id, { id, kind: 'projectile', position: { ...source.position }, velocity: { x: 0, z: 4.2 } });
    }
  }
}
function loseLife() {
  hitCooldown = 1400;
  gameplay.collide(COLLISIONS.GHOST);
  player.position.x = 0;
  player.position.z = 6;
}

async function bootstrap() {
  window.__GAME_READY__ = false;
  initScene(gameRoot);
  resetWorld();
  input.attach();
  gameplay.subscribe(draw);
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Enter') { startIfNeeded(); draw(); }
  });
  gameRoot.addEventListener('pointerdown', startIfNeeded);
  draw();
  window.__GAME_STATE__ = () => snapshot();
  window.__GAME_READY__ = true;
  let previous = performance.now();
  const frame = (now) => {
    simulate(now - previous);
    previous = now;
    draw();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

bootstrap().catch((error) => {
  statusNode.textContent = 'Initialization failed';
  console.error(error);
});

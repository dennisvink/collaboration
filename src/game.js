import { createGameplay, GAME_STATES, COLLISIONS } from './gameplay.js';
import { createInputController } from './input.js';
import { initScene, syncScene } from './scene3d.js';
import { createHUD } from './hud.js';

const gameRoot = document.querySelector('#game');
const controls = document.querySelector('#touch-controls');
const startButton = document.querySelector('#start-button');
const levels = [{ pellets: 28 }, { pellets: 36 }, { pellets: 44 }];
const gameplay = createGameplay({ lives: 3, levels });
const hud = createHUD({ container: gameRoot, onboarding: [
  'Bewegen: pijltjes of W, A, S, D', 'Pauze: P of Escape',
  'Touch: gebruik de richtingsknoppen', 'Herstart: R of de knop in het eindscherm',
] });

let entities = {};
let invaderClock = 0;
let hitCooldown = 0;
let transitionClock = 0;
let previous = performance.now();
let lastStatus = '';

const input = createInputController({ touchRoot: controls, onAction({ action, active }) {
  if (!active) return;
  if (action === 'pause') gameplay.dispatch('TOGGLE_PAUSE');
  if (action === 'restart') restart();
} });
input.attach();

function pelletLayout(count) {
  const points = [];
  const columns = 9;
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    points.push({ x: -8 + col * 2, z: -6.5 + row * 2 });
  }
  return points;
}

function buildLevel(level) {
  const count = levels[level - 1].pellets;
  entities = {
    pacman: { id: 'pacman', kind: 'pacman', position: { x: 0, z: 6.2 }, velocity: { x: 0, z: 0 } },
    invader1: { id: 'invader1', kind: 'invader', position: { x: -6, z: -5 }, velocity: { x: 1, z: 0 } },
    invader2: { id: 'invader2', kind: 'invader', position: { x: 6, z: -5 }, velocity: { x: -1, z: 0 } },
  };
  pelletLayout(count).forEach((position, index) => {
    entities[`pellet${index}`] = { id: `pellet${index}`, kind: index % 13 === 0 ? 'power-pellet' : 'pellet', position };
  });
  invaderClock = 0;
  syncScene({ entities });
}

function start() {
  if (gameplay.getState().status === GAME_STATES.START) gameplay.start();
}
function restart() {
  gameplay.restart();
  buildLevel(1);
  transitionClock = 0;
  start();
}
function distance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function updateWorld(deltaMs) {
  const state = gameplay.getState();
  if (state.status !== GAME_STATES.PLAYING) return;
  const dt = Math.min(deltaMs, 50) / 1000;
  const direction = input.getDirection();
  const length = Math.hypot(direction.x, direction.z) || 1;
  const player = entities.pacman;
  player.velocity = { x: direction.x / length, z: direction.z / length };
  player.position.x = clamp(player.position.x + player.velocity.x * 5.6 * dt, -9.1, 9.1);
  player.position.z = clamp(player.position.z + player.velocity.z * 5.6 * dt, -7.1, 7.1);

  for (const [id, entity] of Object.entries(entities)) {
    if (entity.kind === 'pellet' || entity.kind === 'power-pellet') {
      if (distance(player.position, entity.position) < 0.58) {
        gameplay.collide({ type: entity.kind === 'power-pellet' ? COLLISIONS.POWER_PELLET : COLLISIONS.PELLET });
        delete entities[id];
      }
    }
  }

  const speed = 1.25 + state.level * 0.18;
  for (const invader of [entities.invader1, entities.invader2]) {
    const dx = player.position.x - invader.position.x;
    const dz = player.position.z - invader.position.z;
    const d = Math.hypot(dx, dz) || 1;
    invader.velocity = { x: dx / d, z: dz / d };
    invader.position.x += invader.velocity.x * speed * dt;
    invader.position.z += invader.velocity.z * speed * dt;
    if (hitCooldown <= 0 && distance(player.position, invader.position) < 0.72) takeHit();
  }

  invaderClock += deltaMs;
  if (invaderClock > Math.max(700, 1750 - state.level * 180)) {
    invaderClock = 0;
    const shooter = Math.random() > 0.5 ? entities.invader1 : entities.invader2;
    const dx = player.position.x - shooter.position.x;
    const dz = player.position.z - shooter.position.z;
    const d = Math.hypot(dx, dz) || 1;
    const id = `shot${Math.round(performance.now())}`;
    entities[id] = { id, kind: 'projectile', position: { ...shooter.position }, velocity: { x: dx / d, z: dz / d }, age: 0 };
  }
  for (const [id, projectile] of Object.entries(entities)) {
    if (projectile.kind !== 'projectile') continue;
    projectile.age += deltaMs;
    projectile.position.x += projectile.velocity.x * 4.2 * dt;
    projectile.position.z += projectile.velocity.z * 4.2 * dt;
    if (hitCooldown <= 0 && distance(player.position, projectile.position) < 0.55) { delete entities[id]; takeHit(); }
    else if (projectile.age > 5000) delete entities[id];
  }
  hitCooldown = Math.max(0, hitCooldown - deltaMs);
}

function takeHit() {
  gameplay.collide({ type: COLLISIONS.GHOST });
  hitCooldown = 1600;
  entities.pacman.position = { x: 0, z: 6.2 };
}

function displayState() {
  const state = gameplay.getState();
  const total = levels[state.level - 1]?.pellets ?? levels.at(-1).pellets;
  hud.updateHUD({ ...state, pelletsTotal: total });
  const terminal = state.status === GAME_STATES.GAME_OVER ||
    (state.status === GAME_STATES.LEVEL_WON && state.level === levels.length);
  startButton.hidden = state.status === GAME_STATES.PLAYING || state.status === GAME_STATES.PAUSED;
  if (state.status === GAME_STATES.START) startButton.textContent = 'Start spel';
  else if (state.status === GAME_STATES.PAUSED) startButton.textContent = 'Hervatten';
  else if (terminal) startButton.textContent = 'Opnieuw spelen';
  if (terminal && lastStatus !== state.status) {
    hud.showGameStatus(state.status === GAME_STATES.GAME_OVER ? 'game-over' : { message: 'Je hebt alle levels voltooid! Druk op R om opnieuw te spelen.' });
  }
  lastStatus = state.status;
}

startButton.addEventListener('click', () => {
  const status = gameplay.getState().status;
  if (status === GAME_STATES.PAUSED) gameplay.resume();
  else if (status === GAME_STATES.GAME_OVER || status === GAME_STATES.LEVEL_WON) restart();
  else start();
});
document.addEventListener('keydown', (event) => {
  if (event.code === 'Enter') start();
});
gameplay.subscribe(displayState);

initScene(gameRoot);
buildLevel(1);
displayState();
window.__GAME_READY__ = true;

function frame(now) {
  const delta = now - previous;
  previous = now;
  gameplay.update(delta);
  updateWorld(delta);
  const state = gameplay.getState();
  if (state.status === GAME_STATES.LEVEL_WON && state.level < levels.length) {
    transitionClock += delta;
    if (transitionClock > 1100) {
      gameplay.advanceLevel();
      buildLevel(gameplay.getState().level);
      transitionClock = 0;
    }
  }
  syncScene({ entities });
  displayState();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

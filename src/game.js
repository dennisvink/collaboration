import { createGameplay, GAME_STATES, COLLISIONS } from './gameplay.js';
import { createInputController } from './input.js';
import { initScene, syncScene } from './scene3d.js';
import { createHUD } from './hud.js';

const gameRoot = document.querySelector('#game');
const controls = document.querySelector('#touch-controls');
const status = document.querySelector('#status');
const pelletPositions = [[-8,-6],[-4,-6],[2,-6],[4,-6],[8,-6],[-8,-2],[-4,-2],[0,-2],[4,-2],[8,-2],[-8,2],[-4,2],[0,2],[4,2],[8,2],[-8,6],[-4,6],[2,6],[4,6],[8,6]];
const gameplay = createGameplay({ levels: [{ pellets: 20 }, { pellets: 20 }, { pellets: 20 }], lives: 3 });
const hud = createHUD({ container: gameRoot, onboarding: ['Bewegen: pijltjes of W, A, S, D','Pauze: P, Escape of pauzeknop','Start/herstart: Enter, tik of R'] });
const entities = new Map();
let projectileSequence = 0, shotClock = 0, previous = performance.now();

const spawn = () => ({ x: 2, z: 6 });
function resetWorld() {
  entities.clear(); entities.set('pacman',{ kind:'pacman', position:spawn(), velocity:{x:0,z:0} });
  pelletPositions.forEach(([x,z],index) => entities.set(`pellet-${index}`,{ kind:index % 9 === 0 ? 'power-pellet' : 'pellet', position:{x,z}, active:true }));
  [-7,-4,-1,2,5].forEach((x,index) => entities.set(`invader-${index}`,{ kind:'invader', position:{x,z:-2}, velocity:{x:1.2,z:0}, active:true }));
}
function presentState() { const state = gameplay.getState(); return { ...state, pelletsTotal:pelletPositions.length, entities }; }
function refresh() { const state = presentState(); syncScene(state); hud.updateHUD(state); status.textContent = state.status; document.body.dataset.gameStatus = state.status; }
function startOrContinue() {
  const state = gameplay.getState();
  if (state.status === GAME_STATES.START) gameplay.start();
  else if (state.status === GAME_STATES.PAUSED) gameplay.resume();
  else if (state.status === GAME_STATES.LEVEL_WON && state.level < state.levelCount) { gameplay.advanceLevel(); resetWorld(); }
  else if (state.status === GAME_STATES.GAME_OVER || state.status === GAME_STATES.LEVEL_WON) { gameplay.restart(); resetWorld(); gameplay.start(); }
  refresh();
}

const input = createInputController({ touchRoot:controls, onAction({action,active}) {
  controls?.querySelector(`[data-action="${action}"]`)?.setAttribute('aria-pressed',String(active));
  if (!active) return;
  if (action.startsWith('move-') && gameplay.getState().status === GAME_STATES.START) startOrContinue();
  else if (action === 'pause') gameplay.dispatch('TOGGLE_PAUSE');
  else if (action === 'restart') { gameplay.restart(); resetWorld(); gameplay.start(); }
  refresh();
} });

function blocked(x,z,r=.45) {
  if (x < -9+r || x > 9-r || z < -7+r || z > 7-r) return true;
  const hits = (cx,cz,w,d) => Math.abs(x-cx) < w/2+r && Math.abs(z-cz) < d/2+r;
  return hits(-5,-3,6,.6) || hits(5,3,6,.6) || hits(0,-5.5,.6,5) || hits(0,5.5,.6,5);
}
function moveEntities(deltaSeconds) {
  const player = entities.get('pacman'), direction = input.getDirection(), length = Math.hypot(direction.x,direction.z) || 1;
  player.velocity = { x:direction.x/length*5, z:direction.z/length*5 };
  const next = { x:player.position.x+player.velocity.x*deltaSeconds, z:player.position.z+player.velocity.z*deltaSeconds };
  if (!blocked(next.x,player.position.z)) player.position.x = next.x;
  if (!blocked(player.position.x,next.z)) player.position.z = next.z;
  for (const [id,entity] of [...entities]) {
    if (id.startsWith('pellet-') && distance(player,entity) < .55) { entities.delete(id); gameplay.collide({ type:entity.kind === 'power-pellet' ? COLLISIONS.POWER_PELLET : COLLISIONS.PELLET }); }
    if (id.startsWith('invader-')) {
      const nextX = entity.position.x+entity.velocity.x*deltaSeconds;
      if (blocked(nextX,entity.position.z,.4)) entity.velocity.x *= -1; else entity.position.x = nextX;
      if (distance(player,entity) < .75) { gameplay.collide(COLLISIONS.GHOST); player.position = spawn(); }
    }
    if (id.startsWith('shot-')) {
      entity.position.z -= 9*deltaSeconds; if (entity.position.z < -8) entities.delete(id);
      for (const [invaderId,invader] of entities) if (invaderId.startsWith('invader-') && distance(entity,invader) < .6) { entities.delete(id); entities.delete(invaderId); break; }
    }
  }
  shotClock += deltaSeconds;
  if (shotClock > .8) { shotClock=0; projectileSequence+=1; entities.set(`shot-${projectileSequence}`,{ kind:'projectile', position:{x:player.position.x,z:player.position.z-.6}, velocity:{x:0,z:-9} }); }
}
function distance(a,b) { return Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z); }
function frame(now) { const deltaMs = Math.min(50,now-previous); previous=now; if (gameplay.getState().status === GAME_STATES.PLAYING) { gameplay.update(deltaMs); moveEntities(deltaMs/1000); refresh(); } requestAnimationFrame(frame); }
async function bootstrap() {
  initScene(gameRoot); resetWorld(); input.attach();
  document.addEventListener('keydown',event => { if (event.code === 'Enter') startOrContinue(); });
  gameRoot.addEventListener('click',event => { if (!event.target.closest('button, details')) startOrContinue(); });
  gameplay.subscribe(refresh); refresh(); window.__GAME__={ gameplay,input,entities,startOrContinue }; window.__GAME_READY__=true; requestAnimationFrame(frame);
}
bootstrap().catch(error => { status.textContent=`Initialisatie mislukt: ${error.message}`; console.error(error); });

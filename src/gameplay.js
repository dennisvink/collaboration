import { createInitialGameState } from './contracts.js';

export const GAME_STATES = Object.freeze({
  START: 'start', PLAYING: 'playing', PAUSED: 'paused',
  LEVEL_WON: 'level-won', GAME_OVER: 'game-over',
});
export const COLLISIONS = Object.freeze({
  PELLET: 'pellet', POWER_PELLET: 'power-pellet', GHOST: 'ghost', INVADER: 'invader',
});

const PHASE_FOR_STATUS = Object.freeze({
  [GAME_STATES.START]: 'ready', [GAME_STATES.PLAYING]: 'playing',
  [GAME_STATES.PAUSED]: 'paused', [GAME_STATES.LEVEL_WON]: 'won',
  [GAME_STATES.GAME_OVER]: 'lost',
});

/** Framework-independent state machine built on the shared GameState/GameEvent contracts. */
export function createGameplay(options = {}) {
  const initialLives = positiveInteger(options.lives ?? 3, 'lives');
  const levels = normaliseLevels(options.levels ?? [{ pellets: 1 }]);
  const listeners = new Set();
  const namedListeners = new Map();
  let state = freshState();

  function freshState() {
    return { ...createInitialGameState(), phase: 'ready', status: GAME_STATES.START,
      lives: initialLives, level: 1, pelletsRemaining: levels[0].pellets,
      levelCount: levels.length, shotsFired: 0, invadersDestroyed: 0 };
  }
  function snapshot() { return Object.freeze({ ...state }); }
  function emit(type, payload = {}) {
    const event = Object.freeze({ type,
      timestamp: globalThis.performance?.now?.() ?? Date.now(),
      payload: Object.freeze({ ...payload }) });
    for (const listener of [...listeners]) listener(event);
    for (const listener of [...(namedListeners.get(type) ?? [])]) listener(event);
    return event;
  }
  function transition(status, reason) {
    const from = state.status;
    if (from === status) return snapshot();
    state = { ...state, status, phase: PHASE_FOR_STATUS[status] };
    emit('game:phase-changed', { from, to: status, phase: state.phase, reason });
    return snapshot();
  }
  function start() { return state.status === GAME_STATES.START ? transition(GAME_STATES.PLAYING, 'start') : snapshot(); }
  function pause() { return state.status === GAME_STATES.PLAYING ? transition(GAME_STATES.PAUSED, 'pause') : snapshot(); }
  function resume() { return state.status === GAME_STATES.PAUSED ? transition(GAME_STATES.PLAYING, 'resume') : snapshot(); }

  function shoot(direction) {
    if (state.status !== GAME_STATES.PLAYING) return snapshot();
    const aim = normaliseDirection(direction);
    state = { ...state, shotsFired: state.shotsFired + 1 };
    emit('combat:shot', { direction: aim, shotsFired: state.shotsFired });
    return snapshot();
  }
  function hitInvader(points = 100, id) {
    if (state.status !== GAME_STATES.PLAYING) return snapshot();
    const score = nonNegativeNumber(points, 'points');
    state = { ...state, score: state.score + score, invadersDestroyed: state.invadersDestroyed + 1 };
    emit('combat:invader-hit', { id, points: score, score: state.score,
      invadersDestroyed: state.invadersDestroyed });
    emit('score:changed', { delta: score, score: state.score, collision: COLLISIONS.INVADER });
    return snapshot();
  }

  function collide(collision) {
    if (state.status !== GAME_STATES.PLAYING) return snapshot();
    const data = typeof collision === 'string' ? { type: collision } : collision;
    if (!data || typeof data.type !== 'string') throw new TypeError('collision.type is required');
    if (data.type === COLLISIONS.PELLET || data.type === COLLISIONS.POWER_PELLET) {
      if (state.pelletsRemaining === 0) return snapshot();
      const points = nonNegativeNumber(data.points ?? (data.type === COLLISIONS.POWER_PELLET ? 50 : 10), 'collision.points');
      state = { ...state, score: state.score + points, pelletsRemaining: state.pelletsRemaining - 1 };
      emit('score:changed', { delta: points, score: state.score, collision: data.type });
      if (state.pelletsRemaining === 0) transition(GAME_STATES.LEVEL_WON, 'all-pellets-collected');
      return snapshot();
    }
    if (data.type === COLLISIONS.INVADER) return hitInvader(data.points ?? 100, data.id);
    if (data.type === COLLISIONS.GHOST) {
      if (data.vulnerable) {
        const points = nonNegativeNumber(data.points ?? 200, 'collision.points');
        state = { ...state, score: state.score + points };
        emit('score:changed', { delta: points, score: state.score, collision: data.type });
        return snapshot();
      }
      state = { ...state, lives: state.lives - 1 };
      emit('life:lost', { lives: state.lives, respawn: state.lives > 0 });
      return state.lives === 0 ? transition(GAME_STATES.GAME_OVER, 'no-lives') : snapshot();
    }
    return snapshot();
  }
  function advanceLevel() {
    if (state.status !== GAME_STATES.LEVEL_WON || state.level >= levels.length) return snapshot();
    const nextLevel = state.level + 1;
    state = { ...state, level: nextLevel, pelletsRemaining: levels[nextLevel - 1].pellets };
    return transition(GAME_STATES.PLAYING, 'next-level');
  }
  function restart() {
    const from = state.status; state = freshState();
    emit('game:phase-changed', { from, to: state.status, phase: state.phase, reason: 'restart' });
    emit('game:ready', {}); return snapshot();
  }
  function update(deltaMs) {
    const delta = nonNegativeNumber(deltaMs, 'deltaMs');
    if (state.status === GAME_STATES.PLAYING) state = { ...state, elapsedMs: state.elapsedMs + delta };
    return [];
  }
  function dispatch(action, payload) {
    const type = typeof action === 'string' ? action : action?.type;
    const data = typeof action === 'string' ? payload : action?.payload;
    switch (type) {
      case 'START': return start(); case 'PAUSE': return pause(); case 'RESUME': return resume();
      case 'TOGGLE_PAUSE': return state.status === GAME_STATES.PAUSED ? resume() : pause();
      case 'COLLISION': return collide(data); case 'SHOOT': return shoot(data);
      case 'INVADER_HIT': return hitInvader(data?.points, data?.id);
      case 'ADVANCE_LEVEL': return advanceLevel(); case 'RESTART': return restart();
      case 'UPDATE': update(data); return snapshot();
      default: throw new Error(`Unknown gameplay action: ${String(type)}`);
    }
  }
  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    listeners.add(listener); return () => listeners.delete(listener);
  }
  function on(type, listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    const set = namedListeners.get(type) ?? new Set(); set.add(listener); namedListeners.set(type, set);
    return () => set.delete(listener);
  }
  return Object.freeze({ getState: snapshot, dispatch, update, start, pause, resume,
    shoot, hitInvader, collide, advanceLevel, restart, subscribe, on });
}

/** Creates a deterministic formation that enters from above the maze. */
export function createOverheadWave(options = {}) {
  const count = positiveInteger(options.count ?? 5, 'count');
  const altitude = positiveNumber(options.altitude ?? 8, 'altitude');
  const spacing = positiveNumber(options.spacing ?? 2.5, 'spacing');
  const z = finiteNumber(options.z ?? -5, 'z');
  const speed = positiveNumber(options.speed ?? 0.65, 'speed');
  const centre = (count - 1) / 2;
  return Array.from({ length: count }, (_, index) => ({
    id: `invader-${index}`, kind: 'invader',
    position: { x: (index - centre) * spacing, y: altitude + (index % 2) * 0.6, z },
    velocity: { x: index % 2 ? speed : -speed, y: -0.45, z: 0 },
    minimumAltitude: 2.4, active: true,
  }));
}

/** Advances a descending invader without allowing it to drop below attack altitude. */
export function advanceOverheadInvader(invader, deltaSeconds) {
  const delta = nonNegativeNumber(deltaSeconds, 'deltaSeconds');
  const position = invader?.position;
  if (!position) throw new TypeError('invader.position is required');
  const velocity = invader.velocity ?? {};
  return { ...invader, position: {
    x: position.x + (velocity.x ?? 0) * delta,
    y: Math.max(invader.minimumAltitude ?? 2.4, (position.y ?? 0) + (velocity.y ?? 0) * delta),
    z: position.z + (velocity.z ?? 0) * delta,
  }};
}

export function createEnemyProjectile(invader, target, speed = 6) {
  const origin = invader?.position;
  if (!origin || !target) throw new TypeError('invader.position and target are required');
  const direction = normaliseDirection({
    x: target.x - origin.x, y: (target.y ?? 1.05) - origin.y, z: target.z - origin.z,
  });
  return { kind: 'projectile', hostile: true, position: { ...origin },
    velocity: { x: direction.x * speed, y: direction.y * speed, z: direction.z * speed } };
}

export function advanceProjectile(projectile, deltaSeconds) {
  const delta = nonNegativeNumber(deltaSeconds, 'deltaSeconds');
  return { ...projectile, position: {
    x: projectile.position.x + projectile.velocity.x * delta,
    y: projectile.position.y + projectile.velocity.y * delta,
    z: projectile.position.z + projectile.velocity.z * delta,
  }};
}

function normaliseLevels(levels) {
  if (!Array.isArray(levels) || levels.length === 0) throw new TypeError('levels must be a non-empty array');
  return levels.map((level, index) => ({ ...level,
    pellets: positiveInteger(level?.pellets ?? level?.pelletCount, `levels[${index}].pellets`) }));
}
function normaliseDirection(direction) {
  if (!direction) throw new TypeError('direction is required');
  const x = finiteNumber(direction.x, 'direction.x');
  const y = finiteNumber(direction.y ?? 0, 'direction.y');
  const z = finiteNumber(direction.z, 'direction.z');
  const length = Math.hypot(x, y, z);
  if (!length) throw new RangeError('direction must not be zero');
  return Object.freeze({ x: x / length, y: y / length, z: z / length });
}
function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive integer`);
  return value;
}
function finiteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
}
function positiveNumber(value, name) {
  const number = finiteNumber(value, name); if (number <= 0) throw new RangeError(`${name} must be positive`); return number;
}
function nonNegativeNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be non-negative`);
  return value;
}

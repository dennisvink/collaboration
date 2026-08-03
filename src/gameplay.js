import { createInitialGameState } from './contracts.js';

export const GAME_STATES = Object.freeze({
  START: 'start', PLAYING: 'playing', PAUSED: 'paused',
  LEVEL_WON: 'level-won', GAME_OVER: 'game-over',
});
export const COLLISIONS = Object.freeze({
  PELLET: 'pellet', POWER_PELLET: 'power-pellet', GHOST: 'ghost',
});

const PHASE_FOR_STATUS = Object.freeze({
  [GAME_STATES.START]: 'ready',
  [GAME_STATES.PLAYING]: 'playing',
  [GAME_STATES.PAUSED]: 'paused',
  [GAME_STATES.LEVEL_WON]: 'won',
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
    return {
      ...createInitialGameState(),
      phase: 'ready',
      status: GAME_STATES.START,
      lives: initialLives,
      level: 1,
      pelletsRemaining: levels[0].pellets,
      levelCount: levels.length,
    };
  }

  function snapshot() {
    return Object.freeze({ ...state });
  }

  function emit(type, payload = {}) {
    const event = Object.freeze({
      type,
      timestamp: globalThis.performance?.now?.() ?? Date.now(),
      payload: Object.freeze({ ...payload }),
    });
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

  function start() {
    return state.status === GAME_STATES.START
      ? transition(GAME_STATES.PLAYING, 'start') : snapshot();
  }
  function pause() {
    return state.status === GAME_STATES.PLAYING
      ? transition(GAME_STATES.PAUSED, 'pause') : snapshot();
  }
  function resume() {
    return state.status === GAME_STATES.PAUSED
      ? transition(GAME_STATES.PLAYING, 'resume') : snapshot();
  }

  function collide(collision) {
    if (state.status !== GAME_STATES.PLAYING) return snapshot();
    const data = typeof collision === 'string' ? { type: collision } : collision;
    if (!data || typeof data.type !== 'string') throw new TypeError('collision.type is required');

    if (data.type === COLLISIONS.PELLET || data.type === COLLISIONS.POWER_PELLET) {
      if (state.pelletsRemaining === 0) return snapshot();
      const points = nonNegativeNumber(
        data.points ?? (data.type === COLLISIONS.POWER_PELLET ? 50 : 10),
        'collision.points',
      );
      state = { ...state, score: state.score + points, pelletsRemaining: state.pelletsRemaining - 1 };
      emit('score:changed', { delta: points, score: state.score, collision: data.type });
      if (state.pelletsRemaining === 0) transition(GAME_STATES.LEVEL_WON, 'all-pellets-collected');
      return snapshot();
    }

    if (data.type === COLLISIONS.GHOST) {
      if (data.vulnerable) {
        const points = nonNegativeNumber(data.points ?? 200, 'collision.points');
        state = { ...state, score: state.score + points };
        emit('score:changed', { delta: points, score: state.score, collision: data.type });
        return snapshot();
      }
      state = { ...state, lives: state.lives - 1 };
      emit('life:lost', { lives: state.lives, respawn: state.lives > 0 });
      return state.lives === 0
        ? transition(GAME_STATES.GAME_OVER, 'no-lives') : snapshot();
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
    const from = state.status;
    state = freshState();
    emit('game:phase-changed', { from, to: state.status, phase: state.phase, reason: 'restart' });
    emit('game:ready', {});
    return snapshot();
  }

  /** Advances contract elapsedMs while playing and returns events raised this tick. */
  function update(deltaMs) {
    const delta = nonNegativeNumber(deltaMs, 'deltaMs');
    if (state.status === GAME_STATES.PLAYING) state = { ...state, elapsedMs: state.elapsedMs + delta };
    return [];
  }

  function dispatch(action, payload) {
    const type = typeof action === 'string' ? action : action?.type;
    const data = typeof action === 'string' ? payload : action?.payload;
    switch (type) {
      case 'START': return start();
      case 'PAUSE': return pause();
      case 'RESUME': return resume();
      case 'TOGGLE_PAUSE': return state.status === GAME_STATES.PAUSED ? resume() : pause();
      case 'COLLISION': return collide(data);
      case 'ADVANCE_LEVEL': return advanceLevel();
      case 'RESTART': return restart();
      case 'UPDATE': update(data); return snapshot();
      default: throw new Error(`Unknown gameplay action: ${String(type)}`);
    }
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  function on(type, listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    const set = namedListeners.get(type) ?? new Set();
    set.add(listener); namedListeners.set(type, set);
    return () => set.delete(listener);
  }

  return Object.freeze({ getState: snapshot, dispatch, update, start, pause, resume,
    collide, advanceLevel, restart, subscribe, on });
}

function normaliseLevels(levels) {
  if (!Array.isArray(levels) || levels.length === 0) throw new TypeError('levels must be a non-empty array');
  return levels.map((level, index) => ({ ...level,
    pellets: positiveInteger(level?.pellets ?? level?.pelletCount, `levels[${index}].pellets`) }));
}
function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive integer`);
  return value;
}
function nonNegativeNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be non-negative`);
  return value;
}

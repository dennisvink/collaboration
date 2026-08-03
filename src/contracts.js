/**
 * Shared runtime contracts for the game. These typedefs are the integration
 * boundary: systems may add internal data, but must not change these fields
 * without coordinating a contract version bump.
 *
 * @typedef {'booting'|'ready'|'playing'|'paused'|'won'|'lost'} GamePhase
 * @typedef {'pacman'|'ghost'|'pellet'|'power-pellet'|'wall'} EntityKind
 * @typedef {{x: number, y: number, z: number}} Vector3Data
 *
 * @typedef {Object} GameEntity
 * @property {string} id Stable, unique identifier.
 * @property {EntityKind} kind
 * @property {Vector3Data} position Serializable world position.
 * @property {Vector3Data} velocity Units per second.
 * @property {boolean} active Whether systems should update/render this entity.
 * @property {Record<string, unknown>} [metadata] Extensible domain data.
 *
 * @typedef {Object} GameState
 * @property {1} contractVersion
 * @property {GamePhase} phase
 * @property {number} score
 * @property {number} lives
 * @property {number} level
 * @property {number} elapsedMs Monotonic simulation time.
 * @property {Map<string, GameEntity>} entities Indexed by entity id.
 *
 * @typedef {'game:ready'|'game:phase-changed'|'entity:spawned'|'entity:updated'|'entity:removed'|'score:changed'|'life:lost'} GameEventType
 * @typedef {Object} GameEvent
 * @property {GameEventType} type
 * @property {number} timestamp High-resolution timestamp in milliseconds.
 * @property {Record<string, unknown>} payload
 *
 * @typedef {Object} StateSystem
 * @property {(state: GameState, deltaMs: number) => GameEvent[]} update Pure-ish state update; returns events raised this tick.
 *
 * @typedef {Object} GameRenderer
 * @property {(container: HTMLElement, state: GameState) => void|Promise<void>} initialize
 * @property {(state: GameState, interpolation?: number) => void} render
 * @property {() => void} resize
 * @property {() => void} dispose
 */

/** @returns {GameState} */
export function createInitialGameState() {
  return {
    contractVersion: 1,
    phase: 'booting',
    score: 0,
    lives: 3,
    level: 1,
    elapsedMs: 0,
    entities: new Map(),
  };
}

/**
 * Small typed-by-JSDoc event hub shared by independently developed modules.
 * @returns {{emit: (event: GameEvent) => void, subscribe: (listener: (event: GameEvent) => void) => () => void}}
 */
export function createGameEventBus() {
  const listeners = new Set();
  return {
    emit(event) {
      for (const listener of listeners) listener(event);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

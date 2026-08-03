import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLISIONS, createGameplay, GAME_STATES } from '../src/gameplay.js';

test('start, pause and resume map to shared contract phases', () => {
  const game = createGameplay({ levels: [{ pellets: 2 }] });
  assert.equal(game.getState().status, GAME_STATES.START);
  assert.equal(game.getState().phase, 'ready');
  game.pause();
  assert.equal(game.getState().status, GAME_STATES.START);
  game.start();
  assert.equal(game.getState().phase, 'playing');
  game.pause();
  assert.equal(game.getState().phase, 'paused');
  game.resume();
  assert.equal(game.getState().status, GAME_STATES.PLAYING);
});

test('pellet collisions score points and win a level', () => {
  const events = [];
  const game = createGameplay({ levels: [{ pellets: 2 }] });
  game.subscribe(event => events.push(event));
  game.start();
  game.collide(COLLISIONS.PELLET);
  assert.equal(game.getState().score, 10);
  assert.equal(game.getState().pelletsRemaining, 1);
  game.collide({ type: COLLISIONS.POWER_PELLET });
  assert.equal(game.getState().status, GAME_STATES.LEVEL_WON);
  assert.equal(game.getState().phase, 'won');
  assert.equal(game.getState().score, 60);
  assert.ok(events.some(event => event.type === 'score:changed'));
  assert.ok(events.every(event => typeof event.timestamp === 'number' && event.payload));
});

test('advanceLevel loads the next level and resumes play', () => {
  const game = createGameplay({ levels: [{ pellets: 1 }, { pelletCount: 3 }] });
  game.start();
  game.collide(COLLISIONS.PELLET);
  game.advanceLevel();
  assert.equal(game.getState().status, GAME_STATES.PLAYING);
  assert.equal(game.getState().level, 2);
  assert.equal(game.getState().pelletsRemaining, 3);
});

test('ghost collisions consume lives and eventually end game', () => {
  const lostLives = [];
  const game = createGameplay({ lives: 2, levels: [{ pellets: 1 }] });
  game.on('life:lost', event => lostLives.push(event.payload.lives));
  game.start();
  game.collide(COLLISIONS.GHOST);
  assert.equal(game.getState().lives, 1);
  assert.equal(game.getState().status, GAME_STATES.PLAYING);
  assert.deepEqual(lostLives, [1]);
  game.dispatch('COLLISION', { type: COLLISIONS.GHOST });
  assert.equal(game.getState().lives, 0);
  assert.equal(game.getState().status, GAME_STATES.GAME_OVER);
  assert.equal(game.getState().phase, 'lost');
});

test('vulnerable ghost scores without costing a life', () => {
  const game = createGameplay({ levels: [{ pellets: 1 }] });
  game.start();
  game.collide({ type: COLLISIONS.GHOST, vulnerable: true, points: 400 });
  assert.equal(game.getState().score, 400);
  assert.equal(game.getState().lives, 3);
});

test('restart resets contract state from game over', () => {
  const game = createGameplay({ lives: 1, levels: [{ pellets: 2 }, { pellets: 1 }] });
  game.dispatch({ type: 'START' });
  game.dispatch({ type: 'COLLISION', payload: { type: COLLISIONS.PELLET } });
  game.dispatch({ type: 'COLLISION', payload: { type: COLLISIONS.GHOST } });
  game.dispatch('RESTART');
  const state = game.getState();
  assert.equal(state.contractVersion, 1);
  assert.equal(state.status, GAME_STATES.START);
  assert.equal(state.phase, 'ready');
  assert.equal(state.level, 1);
  assert.equal(state.score, 0);
  assert.equal(state.lives, 1);
  assert.equal(state.pelletsRemaining, 2);
  assert.ok(state.entities instanceof Map);
});

test('paused gameplay ignores collisions and elapsed time', () => {
  const game = createGameplay({ levels: [{ pellets: 1 }] });
  game.start();
  game.update(16);
  assert.equal(game.getState().elapsedMs, 16);
  game.pause();
  game.collide(COLLISIONS.PELLET);
  game.update(16);
  assert.equal(game.getState().pelletsRemaining, 1);
  assert.equal(game.getState().elapsedMs, 16);
});

test('snapshots are immutable and subscriptions can be removed', () => {
  const game = createGameplay({ levels: [{ pellets: 1 }] });
  let calls = 0;
  const unsubscribe = game.subscribe(() => calls++);
  assert.throws(() => { game.getState().score = 99; }, TypeError);
  game.start();
  assert.ok(calls > 0);
  const previousCalls = calls;
  unsubscribe();
  game.pause();
  assert.equal(calls, previousCalls);
});

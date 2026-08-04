import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLISIONS, createGameplay, createOverheadWave, advanceOverheadInvader,
  createEnemyProjectile, advanceProjectile,
} from '../src/gameplay.js';

test('shooting records a normalized pitch-aware aim vector', () => {
  const events = [];
  const game = createGameplay({ levels: [{ pellets: 1 }] });
  game.on('combat:shot', event => events.push(event));
  game.start();
  game.shoot({ x: 0, y: 4, z: -3 });
  assert.equal(game.getState().shotsFired, 1);
  assert.deepEqual(events[0].payload.direction, { x: 0, y: 0.8, z: -0.6 });
  assert.ok(events[0].payload.direction.y > 0, 'upward pitch must remain upward');
});

test('invader hits remove no lives and award combat score', () => {
  const game = createGameplay({ levels: [{ pellets: 1 }] });
  game.start();
  game.collide({ type: COLLISIONS.INVADER, id: 'invader-2', points: 125 });
  assert.equal(game.getState().score, 125);
  assert.equal(game.getState().invadersDestroyed, 1);
  assert.equal(game.getState().lives, 3);
});

test('overhead wave spawns above the arena and descends to attack altitude', () => {
  const wave = createOverheadWave({ count: 3, altitude: 9, spacing: 2 });
  assert.equal(wave.length, 3);
  assert.ok(wave.every(invader => invader.position.y >= 9));
  const advanced = advanceOverheadInvader(wave[0], 30);
  assert.equal(advanced.position.y, wave[0].minimumAltitude);
  assert.notEqual(advanced.position.x, wave[0].position.x);
});

test('enemy projectile travels from an overhead invader toward the player', () => {
  const [invader] = createOverheadWave({ count: 1, altitude: 8 });
  const shot = createEnemyProjectile(invader, { x: 0, y: 1, z: 4 }, 6);
  assert.ok(shot.velocity.y < 0, 'overhead attack must travel downward');
  assert.ok(shot.velocity.z > 0, 'attack must travel toward player');
  const advanced = advanceProjectile(shot, 0.5);
  assert.ok(advanced.position.y < shot.position.y);
  assert.ok(advanced.position.z > shot.position.z);
});

test('combat commands are ignored while not playing', () => {
  const game = createGameplay({ levels: [{ pellets: 1 }] });
  game.shoot({ x: 0, y: 1, z: 0 });
  game.hitInvader(100, 'invader-0');
  assert.equal(game.getState().shotsFired, 0);
  assert.equal(game.getState().invadersDestroyed, 0);
});

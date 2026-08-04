import test from 'node:test';
import assert from 'node:assert/strict';
import { aimIndicator, presentationPose } from '../src/fps.js';

test('FPS presentation reacts to movement, pitch and recoil', () => {
  const idle=presentationPose({now:1000});
  const active=presentationPose({pitch:.6,moving:true,now:1000,firedAt:950});
  assert.equal(idle.recoil,0);
  assert.ok(active.recoil>0);
  assert.notEqual(active.y,idle.y);
  assert.ok(active.rotation<idle.rotation);
  assert.equal(presentationPose({now:1200,firedAt:950}).recoil,0);
});

test('aim indicator communicates full vertical range', () => {
  assert.equal(aimIndicator(Math.PI*.42).direction,'sky');
  assert.equal(aimIndicator(-Math.PI*.42).direction,'ground');
  assert.equal(aimIndicator(0).direction,'level');
  assert.equal(aimIndicator(99).normalized,1);
});

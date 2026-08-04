import test from 'node:test'; import assert from 'node:assert/strict';
import {moveVector,lookVector,clampPitch,hitscan,canFire} from '../src/fps.js'; import {moveWithWallSlide,rayWallDistance,validSpawn} from '../src/world.js';
test('yaw and movement vectors',()=>{assert.deepEqual(moveVector(0,1,0),{x:0,z:-1});assert.ok(Math.abs(lookVector(Math.PI/2).x+1)<1e-9);assert.ok(clampPitch(99)<Math.PI/2)});
test('bounds, wall collision and wall slide',()=>{assert.equal(validSpawn({x:0,z:-5.5}),false);const p=moveWithWallSlide({x:-3,z:-2.3},{x:0,z:-1});assert.equal(p.z,-2.3);const slide=moveWithWallSlide({x:-3,z:-2.3},{x:-1,z:-1});assert.equal(slide.x,-4);assert.equal(slide.z,-2.3)});
test('ray wall occlusion, nearest visible hit and miss',()=>{assert.ok(rayWallDistance({x:2,z:6},{x:0,z:-1})<12);const es=new Map([['invader-a',{position:{x:1,z:4}}],['invader-b',{position:{x:1,z:2}}]]);assert.equal(hitscan({x:1,z:6},{x:0,z:-1},es).id,'invader-a');assert.equal(hitscan({x:8,z:6},{x:1,z:0},es),null)});
test('cooldown is monotone',()=>{assert.equal(canFire(100,0,350),false);assert.equal(canFire(350,0,350),true);assert.equal(canFire(349,0,350),false)});
test('spawn validation',()=>{assert.equal(validSpawn({x:2,z:6}),true);assert.equal(validSpawn({x:0,z:6}),false);assert.equal(validSpawn({x:10,z:0}),false)});

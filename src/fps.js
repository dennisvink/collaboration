import { rayWallDistance } from './world.js';
export const FIRE_COOLDOWN_MS = 350;
export function clampPitch(value) { return Math.max(-Math.PI*.42, Math.min(Math.PI*.42, value)); }
export function lookVector(yaw, pitch=0) { const c=Math.cos(pitch); return {x:-Math.sin(yaw)*c,y:Math.sin(pitch),z:-Math.cos(yaw)*c}; }
export function moveVector(yaw, forward, strafe) {
  const x=-Math.sin(yaw)*forward+Math.cos(yaw)*strafe, z=-Math.cos(yaw)*forward-Math.sin(yaw)*strafe;
  const length=Math.hypot(x,z)||1; return {x:x/length,z:z/length};
}
export function canFire(now, lastFire, cooldown=FIRE_COOLDOWN_MS) { return now-lastFire >= cooldown; }
export function hitscan(origin, direction, entities, maxDistance=30) {
  const wallDistance=rayWallDistance(origin,direction,maxDistance); let hit=null, nearest=wallDistance;
  for (const [id,e] of entities) {
    if (!id.startsWith('invader-') || e.active===false) continue;
    const dx=e.position.x-origin.x, dz=e.position.z-origin.z;
    const along=dx*direction.x+dz*direction.z;
    if (along<=0 || along>=nearest) continue;
    const perpendicular=Math.abs(dx*direction.z-dz*direction.x);
    if (perpendicular<=.55) { nearest=along; hit={id,entity:e,distance:along}; }
  }
  return hit;
}

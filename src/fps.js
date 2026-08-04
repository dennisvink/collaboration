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
    const dx=e.position.x-origin.x, dy=(e.position.y ?? origin.y ?? 0)-(origin.y ?? 0), dz=e.position.z-origin.z;
    const along=dx*direction.x+dy*(direction.y ?? 0)+dz*direction.z;
    if (along<=0 || along>=nearest) continue;
    const distanceSquared=dx*dx+dy*dy+dz*dz-along*along;
    if (distanceSquared<=.55*.55) { nearest=along; hit={id,entity:e,distance:along}; }
  }
  return hit;
}

export function presentationPose({ pitch=0, moving=false, now=0, firedAt=-Infinity }={}) {
  const recoil=Math.max(0, 1-(now-firedAt)/140);
  const bob=moving ? Math.sin(now*.012)*4 : 0;
  return Object.freeze({
    x:bob*.35,
    y:Math.max(-10,Math.min(10,-pitch*8))+Math.abs(bob),
    rotation:-pitch*.08-recoil*.12,
    recoil,
  });
}

export function aimIndicator(pitch=0) {
  const normalized=Math.max(-1,Math.min(1,pitch/(Math.PI*.42)));
  return Object.freeze({ normalized, direction:normalized>.2?'sky':normalized<-.2?'ground':'level' });
}

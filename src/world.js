export const WALLS = Object.freeze([
  { x: 0, z: -8, w: 20, d: 1 }, { x: 0, z: 8, w: 20, d: 1 },
  { x: -10, z: 0, w: 1, d: 16 }, { x: 10, z: 0, w: 1, d: 16 },
  { x: -5, z: -3, w: 6, d: .6 }, { x: 5, z: 3, w: 6, d: .6 },
  { x: 0, z: -5.5, w: .6, d: 5 }, { x: 0, z: 5.5, w: .6, d: 5 },
]);

export function overlapsWall(position, radius = .35, walls = WALLS) {
  return walls.some(({x,z,w,d}) => Math.abs(position.x-x) < w/2+radius && Math.abs(position.z-z) < d/2+radius);
}
export function validSpawn(position, radius = .35) {
  return Math.abs(position.x) < 9.4-radius && Math.abs(position.z) < 7.4-radius && !overlapsWall(position, radius);
}
export function moveWithWallSlide(position, delta, radius = .35) {
  const result = {...position};
  const x = {x: result.x + delta.x, z: result.z};
  if (validSpawn(x, radius)) result.x = x.x;
  const z = {x: result.x, z: result.z + delta.z};
  if (validSpawn(z, radius)) result.z = z.z;
  return result;
}
function rayBox(origin, direction, wall, maxDistance) {
  const minX=wall.x-wall.w/2, maxX=wall.x+wall.w/2, minZ=wall.z-wall.d/2, maxZ=wall.z+wall.d/2;
  let near=0, far=maxDistance;
  for (const [o,v,min,max] of [[origin.x,direction.x,minX,maxX],[origin.z,direction.z,minZ,maxZ]]) {
    if (Math.abs(v) < 1e-9) { if (o < min || o > max) return Infinity; continue; }
    const a=(min-o)/v, b=(max-o)/v;
    near=Math.max(near,Math.min(a,b)); far=Math.min(far,Math.max(a,b));
    if (near>far) return Infinity;
  }
  return near;
}
export function rayWallDistance(origin, direction, maxDistance=30, walls=WALLS) {
  return Math.min(maxDistance, ...walls.map(w => rayBox(origin,direction,w,maxDistance)));
}

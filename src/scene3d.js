import * as THREE from 'three';
import { WALLS } from './world.js';
let scene,camera,renderer,container; const meshes=new Map();
function mesh(kind){
 const colors={pacman:0xffd800,invader:0xff3344,pellet:0xffffcc,'power-pellet':0xffffff,projectile:0x00ffff};
 const geometry=kind==='invader'?new THREE.BoxGeometry(.8,.7,.5):kind==='projectile'?new THREE.CapsuleGeometry(.07,.25,3,6):new THREE.SphereGeometry(kind?.includes('pellet')?.13:.35,12,8);
 return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:colors[kind]||0xffffff,emissive:colors[kind]||0,emissiveIntensity:.18}));
}
export function initScene(target='#game'){
 container=typeof target==='string'?document.querySelector(target):target; if(!container) throw Error('Scene container not found');
 scene=new THREE.Scene(); scene.background=new THREE.Color(0x020208); scene.fog=new THREE.Fog(0x020208,12,32);
 camera=new THREE.PerspectiveCamera(70,1,.05,100); renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio||1,2)); container.append(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xccddff,0x101020,2.3)); const light=new THREE.DirectionalLight(0xffffff,2); light.position.set(3,8,4); scene.add(light);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,16),new THREE.MeshStandardMaterial({color:0x040412})); floor.rotation.x=-Math.PI/2; scene.add(floor);
 const material=new THREE.MeshStandardMaterial({color:0x1239b8,emissive:0x051444}); for(const w of WALLS){const m=new THREE.Mesh(new THREE.BoxGeometry(w.w,1.4,w.d),material);m.position.set(w.x,.7,w.z);scene.add(m);}
 const resize=()=>{camera.aspect=Math.max(1,container.clientWidth)/Math.max(1,container.clientHeight);camera.updateProjectionMatrix();renderer.setSize(container.clientWidth,container.clientHeight,false)}; resize(); new ResizeObserver(resize).observe(container);
 const loop=()=>{renderer.render(scene,camera);requestAnimationFrame(loop)}; requestAnimationFrame(loop); return {scene,camera,renderer};
}
export function setFirstPersonView(position,yaw,pitch){ if(!camera)return; camera.position.set(position.x,1.05,position.z); camera.rotation.order='YXZ'; camera.rotation.set(pitch,yaw,0); }
export function syncScene(state){ if(!scene)return; const present=new Set(); for(const [id,e] of state.entities){if(e.active===false||id==='pacman')continue;present.add(id);let m=meshes.get(id);if(!m){m=mesh(e.kind);meshes.set(id,m);scene.add(m)}m.position.set(e.position.x,e.kind?.includes('pellet')?.18:.45,e.position.z)}for(const [id,m] of meshes)if(!present.has(id)){scene.remove(m);meshes.delete(id)}}
export function renderFrame(){ if(renderer)renderer.render(scene,camera); }

import { aimIndicator, presentationPose } from './fps.js';
let activeHUD;
const copy = { ready:'Druk Enter of tik om te starten', start:'Druk Enter of tik om te starten', paused:'Pauze', 'level-won':'Level voltooid — tik voor het volgende level', 'game-over':'Game over — R of Herstart' };

export function createHUD({ container = document.body, onboarding = [] } = {}) {
  activeHUD?.destroy();
  const root = document.createElement('section');
  root.className = 'pacman-hud'; root.setAttribute('aria-label','Spelinformatie');
  root.innerHTML = `<style>
  .fps-crosshair{position:fixed;left:50%;top:50%;width:34px;height:34px;transform:translate(-50%,-50%);pointer-events:none;z-index:7;filter:drop-shadow(0 1px 2px #000)}
  .fps-crosshair:before,.fps-crosshair:after{content:"";position:absolute;background:#fff;border:1px solid #07131f;box-shadow:0 0 6px #36d9ff}
  .fps-crosshair:before{left:15px;top:2px;width:2px;height:30px}.fps-crosshair:after{left:2px;top:15px;width:30px;height:2px}
  .fps-crosshair__pitch{position:absolute;left:42px;top:7px;color:#fff;font:700 10px/1 system-ui;text-transform:uppercase;text-shadow:0 1px 2px #000}
  .fps-viewmodel{position:fixed;left:50%;bottom:-3vh;width:min(52vw,580px);height:min(31vh,300px);transform:translateX(-50%);transform-origin:50% 100%;pointer-events:none;z-index:6;will-change:transform}
  .fps-body{position:absolute;left:29%;bottom:-42%;width:42%;height:90%;border-radius:50% 50% 18% 18%;background:radial-gradient(circle at 38% 25%,#fff36a 0 3%,#f4c400 38%,#9c6300 100%);box-shadow:inset -18px -22px 32px #6a3d0080,0 10px 30px #0008}
  .fps-weapon{position:absolute;left:43%;bottom:20%;width:14%;height:65%;border-radius:12px 12px 5px 5px;background:linear-gradient(90deg,#18222b,#87939c 38%,#26323b 58%,#090d11);box-shadow:inset 0 0 0 2px #a9d6e8aa,0 6px 15px #000;transform:perspective(180px) rotateX(-8deg)}
  .fps-weapon:before{content:"";position:absolute;left:18%;top:-18%;width:64%;height:25%;border-radius:50%;background:radial-gradient(circle,#071018 0 35%,#5f7482 38% 58%,#111 62%)}
  .fps-hand{position:absolute;bottom:15%;width:24%;height:28%;border-radius:48% 48% 38% 38%;background:radial-gradient(circle at 36% 28%,#fff57c,#efb900 62%,#8b5700);box-shadow:inset -8px -9px 13px #70400080,0 5px 10px #0008}
  .fps-hand--left{left:17%;transform:rotate(24deg)}.fps-hand--right{right:17%;transform:rotate(-24deg)}
  .fps-viewmodel.is-firing .fps-weapon:after{content:"";position:absolute;left:-34%;top:-50%;width:168%;height:48%;border-radius:50%;background:radial-gradient(circle,#fff 0 8%,#ffe75c 18%,#ff7a00 42%,transparent 70%);filter:blur(1px)}
  @media(max-width:700px){.fps-viewmodel{width:72vw;height:24vh;bottom:0}.fps-crosshair__pitch{display:none}}
  </style><div class="pacman-hud__stats"><p>Score <strong data-score>0</strong></p><p>Levens <strong data-lives>3</strong></p><p>Level <strong data-level>1</strong></p></div><p data-progress>0/0 pellets</p><p class="pacman-hud__status" data-status role="status" aria-live="polite"></p><details open><summary>Besturing</summary><ul>${onboarding.map(item=>`<li>${item}</li>`).join('')}</ul></details><div class="fps-crosshair" aria-hidden="true"><span class="fps-crosshair__pitch" data-aim>LEVEL</span></div><div class="fps-viewmodel" data-viewmodel aria-hidden="true"><div class="fps-body"></div><div class="fps-hand fps-hand--left"></div><div class="fps-hand fps-hand--right"></div><div class="fps-weapon"></div></div>`;
  container.append(root);
  const viewmodel=root.querySelector('[data-viewmodel]'), aim=root.querySelector('[data-aim]');
  let firedAt=-Infinity;
  const hud = {
    element:root,
    updateHUD(state) {
      root.querySelector('[data-score]').textContent=state.score??0; root.querySelector('[data-lives]').textContent=state.lives??0; root.querySelector('[data-level]').textContent=state.level??1;
      const total=state.pelletsTotal??0; root.querySelector('[data-progress]').textContent=`${Math.max(0,total-(state.pelletsRemaining??total))}/${total} pellets`;
      hud.showGameStatus(state.status??state.phase); return hud;
    },
    updatePresentation({pitch=0,moving=false,now=performance.now()}={}) {
      const pose=presentationPose({pitch,moving,now,firedAt}), indicator=aimIndicator(pitch);
      viewmodel.style.transform=`translateX(calc(-50% + ${pose.x}px)) translateY(${pose.y+pose.recoil*12}px) rotate(${pose.rotation}rad)`;
      viewmodel.classList.toggle('is-firing',pose.recoil>.05); aim.textContent=indicator.direction;
      return hud;
    },
    showFireFeedback(now=performance.now()) { firedAt=now; return hud.updatePresentation({now}); },
    showGameStatus(status) { root.querySelector('[data-status]').textContent=copy[status]??''; return hud; },
    destroy() { root.remove(); if(activeHUD===hud) activeHUD=null; },
  };
  activeHUD=hud; return Object.freeze(hud);
}
export function updateHUD(state) { if(!activeHUD) throw new Error('Call createHUD first'); return activeHUD.updateHUD(state); }
export function showGameStatus(status) { if(!activeHUD) throw new Error('Call createHUD first'); return activeHUD.showGameStatus(status); }

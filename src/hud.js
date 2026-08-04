let activeHUD;
const copy = { ready: 'Druk Enter of tik om te starten', start: 'Druk Enter of tik om te starten', paused: 'Pauze', 'level-won': 'Level voltooid — tik voor het volgende level', 'game-over': 'Game over — R of Herstart' };

export function createHUD({ container = document.body, onboarding = [] } = {}) {
  activeHUD?.destroy();
  const root = document.createElement('section');
  root.className = 'pacman-hud';
  root.setAttribute('aria-label', 'Spelinformatie');
  root.innerHTML = `<div class="pacman-hud__stats"><p>Score <strong data-score>0</strong></p><p>Levens <strong data-lives>3</strong></p><p>Level <strong data-level>1</strong></p></div><p data-progress>0/0 pellets</p><p class="pacman-hud__status" data-status role="status" aria-live="polite"></p><details open><summary>Besturing</summary><ul>${onboarding.map(item => `<li>${item}</li>`).join('')}</ul></details>`;
  container.append(root);
  const hud = {
    element: root,
    updateHUD(state) {
      root.querySelector('[data-score]').textContent = state.score ?? 0;
      root.querySelector('[data-lives]').textContent = state.lives ?? 0;
      root.querySelector('[data-level]').textContent = state.level ?? 1;
      const total = state.pelletsTotal ?? 0;
      root.querySelector('[data-progress]').textContent = `${Math.max(0, total - (state.pelletsRemaining ?? total))}/${total} pellets`;
      hud.showGameStatus(state.status ?? state.phase);
      return hud;
    },
    showGameStatus(status) { root.querySelector('[data-status]').textContent = copy[status] ?? ''; return hud; },
    destroy() { root.remove(); if (activeHUD === hud) activeHUD = null; },
  };
  activeHUD = hud;
  return Object.freeze(hud);
}
export function updateHUD(state) { if (!activeHUD) throw new Error('Call createHUD first'); return activeHUD.updateHUD(state); }
export function showGameStatus(status) { if (!activeHUD) throw new Error('Call createHUD first'); return activeHUD.showGameStatus(status); }

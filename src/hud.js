const STATUS_COPY = Object.freeze({
  booting: 'Spel wordt geladen…',
  ready: 'Klaar? Druk op Enter of tik om te starten.',
  start: 'Klaar? Druk op Enter of tik om te starten.',
  playing: '',
  paused: 'Pauze — druk op P of tik op hervatten.',
  won: 'Level voltooid!',
  'level-won': 'Level voltooid!',
  lost: 'Game over — druk op R om opnieuw te beginnen.',
  'game-over': 'Game over — druk op R om opnieuw te beginnen.',
});

const DEFAULT_ONBOARDING = Object.freeze([
  'Bewegen: pijltjestoetsen of W, A, S, D',
  'Pauze: P of Escape',
  'Touch: veeg in de gewenste richting',
]);

let activeHUD = null;

/**
 * Creates the browser-native HUD and makes it the target of the module-level
 * updateHUD/showGameStatus functions.
 * @param {{container?: HTMLElement, document?: Document, onboarding?: string[]}} [options]
 */
export function createHUD(options = {}) {
  const doc = options.document ?? globalThis.document;
  if (!doc?.createElement) throw new Error('createHUD requires a browser document');
  const container = options.container ?? doc.body;
  if (!container?.append) throw new TypeError('container must be an HTMLElement');

  activeHUD?.destroy();
  installStyles(doc);

  const root = doc.createElement('section');
  root.className = 'pacman-hud';
  root.setAttribute('aria-label', 'Spelinformatie');
  root.innerHTML = `
    <div class="pacman-hud__stats">
      <p><span>Score</span><strong data-hud="score">0</strong></p>
      <p><span>Levens</span><strong data-hud="lives" aria-label="3 levens">● ● ●</strong></p>
      <p><span>Level</span><strong data-hud="level">1</strong></p>
    </div>
    <div class="pacman-hud__progress">
      <div class="pacman-hud__progress-copy">
        <span data-hud="progress-label">Voortgang</span>
        <span data-hud="progress-value">0%</span>
      </div>
      <progress data-hud="progress" max="100" value="0">0%</progress>
      <small data-hud="balance">Snelheid ×1.00 · score ×1.00</small>
    </div>
    <p class="pacman-hud__status" data-hud="status" role="status" aria-live="polite"></p>
    <details class="pacman-hud__onboarding" open>
      <summary>Besturing</summary>
      <ul data-hud="onboarding"></ul>
    </details>`;

  const nodes = Object.fromEntries(
    [...root.querySelectorAll('[data-hud]')].map((node) => [node.dataset.hud, node]),
  );
  for (const instruction of options.onboarding ?? DEFAULT_ONBOARDING) {
    const item = doc.createElement('li');
    item.textContent = instruction;
    nodes.onboarding.append(item);
  }
  container.append(root);

  const hud = {
    element: root,
    updateHUD(state) {
      renderState(nodes, state);
      return hud;
    },
    showGameStatus(status) {
      renderStatus(nodes.status, status);
      return hud;
    },
    destroy() {
      root.remove();
      if (activeHUD === hud) activeHUD = null;
    },
  };
  activeHUD = hud;
  hud.updateHUD({ score: 0, lives: 3, level: 1, phase: 'ready' });
  return Object.freeze(hud);
}

/** Updates the active HUD from the shared GameState/gameplay snapshot. */
export function updateHUD(state) {
  return requireHUD().updateHUD(state);
}

/** Shows a phase/status or a custom status message in the active live region. */
export function showGameStatus(status) {
  return requireHUD().showGameStatus(status);
}

function requireHUD() {
  if (!activeHUD) throw new Error('Call createHUD() before updating the HUD');
  return activeHUD;
}

function renderState(nodes, state) {
  if (!state || typeof state !== 'object') throw new TypeError('state must be an object');
  const score = nonNegative(state.score, 0);
  const lives = Math.floor(nonNegative(state.lives, 0));
  const level = Math.max(1, Math.floor(nonNegative(state.level, 1)));
  const progress = calculateProgress(state);

  nodes.score.textContent = score.toLocaleString('nl-NL');
  nodes.lives.textContent = lives ? Array.from({ length: lives }, () => '●').join(' ') : '—';
  nodes.lives.setAttribute('aria-label', `${lives} ${lives === 1 ? 'leven' : 'levens'}`);
  nodes.level.textContent = String(level);
  nodes.progress.value = progress.percent;
  nodes.progress.textContent = `${progress.percent}%`;
  nodes.progressValue.textContent = `${progress.percent}%`;
  nodes.progressLabel.textContent = progress.label;

  const speedMultiplier = finitePositive(
    state.speedMultiplier ?? state.difficulty?.speedMultiplier,
    1 + ((level - 1) * 0.08),
  );
  const scoreMultiplier = finitePositive(
    state.scoreMultiplier ?? state.difficulty?.scoreMultiplier,
    1 + (Math.floor((level - 1) / 3) * 0.1),
  );
  nodes.balance.textContent = `Snelheid ×${speedMultiplier.toFixed(2)} · score ×${scoreMultiplier.toFixed(2)}`;

  const status = state.status ?? state.phase;
  if (status !== undefined) renderStatus(nodes.status, status);
}

function calculateProgress(state) {
  const total = nonNegative(
    state.pelletsTotal ?? state.levelPellets ?? state.pelletCount ?? state.progress?.total,
    0,
  );
  const remaining = nonNegative(
    state.pelletsRemaining ?? state.progress?.remaining,
    total,
  );
  if (total > 0) {
    const collected = Math.min(total, Math.max(0, total - remaining));
    return {
      percent: Math.round((collected / total) * 100),
      label: `${collected}/${total} pellets`,
    };
  }
  const ratio = Number(state.progress?.ratio ?? state.levelProgress ?? 0);
  const percent = Number.isFinite(ratio)
    ? Math.round(Math.min(1, Math.max(0, ratio > 1 ? ratio / 100 : ratio)) * 100)
    : 0;
  return { percent, label: 'Voortgang' };
}

function renderStatus(node, status) {
  const descriptor = typeof status === 'object' && status
    ? status
    : { status };
  const key = String(descriptor.status ?? descriptor.phase ?? '').toLowerCase();
  const message = descriptor.message ?? STATUS_COPY[key] ?? String(descriptor.status ?? '');
  node.textContent = message;
  node.hidden = !message;
}

function nonNegative(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function finitePositive(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function installStyles(doc) {
  if (doc.querySelector('style[data-pacman-hud-styles]')) return;
  const style = doc.createElement('style');
  style.dataset.pacmanHudStyles = '';
  style.textContent = `
    .pacman-hud{position:absolute;inset:0;z-index:10;display:grid;grid-template-columns:minmax(16rem,26rem) 1fr;align-content:start;gap:.75rem;padding:clamp(.75rem,2vw,1.5rem);color:#fff;font:600 clamp(.85rem,2vw,1rem)/1.35 system-ui,sans-serif;pointer-events:none;text-shadow:0 2px 4px #000;background:linear-gradient(#0009,transparent 35%)}
    .pacman-hud__stats{display:flex;gap:.65rem}.pacman-hud__stats p{min-width:4.5rem;margin:0;padding:.5rem .7rem;border:1px solid #ffe60066;border-radius:.5rem;background:#080816d9}.pacman-hud__stats span{display:block;color:#ffe600;font-size:.72em;text-transform:uppercase}.pacman-hud__stats strong{font-size:1.2em}
    .pacman-hud__progress{grid-column:1;display:grid;gap:.2rem;padding:.5rem .7rem;border-radius:.5rem;background:#080816d9}.pacman-hud__progress-copy{display:flex;justify-content:space-between}.pacman-hud progress{width:100%;accent-color:#ffe600}.pacman-hud__progress small{color:#c9c9df}
    .pacman-hud__status{grid-column:1/-1;justify-self:center;margin:12vh 0 0;padding:.75rem 1.1rem;border:2px solid #ffe600;border-radius:.65rem;background:#080816ed;font-size:clamp(1rem,3vw,1.5rem);text-align:center}
    .pacman-hud__onboarding{grid-column:1;max-width:25rem;padding:.4rem .7rem;border-radius:.5rem;background:#080816d9;pointer-events:auto}.pacman-hud__onboarding summary{cursor:pointer;color:#ffe600}.pacman-hud__onboarding ul{margin:.35rem 0 .2rem;padding-left:1.2rem;font-weight:400}
    @media(max-width:560px){.pacman-hud{grid-template-columns:1fr}.pacman-hud__stats{justify-content:space-between}.pacman-hud__stats p{min-width:0;flex:1}.pacman-hud__onboarding{font-size:.78rem}}
    @media(prefers-reduced-motion:reduce){.pacman-hud *{scroll-behavior:auto!important;transition:none!important}}
  `;
  (doc.head ?? doc.documentElement).append(style);
}

const DIRECTIONS = Object.freeze(['move-up', 'move-down', 'move-left', 'move-right']);

export const INPUT_ACTIONS = Object.freeze([
  ...DIRECTIONS,
  'pause',
  'restart',
]);

export const DEFAULT_KEY_BINDINGS = Object.freeze({
  'move-up': Object.freeze(['ArrowUp', 'KeyW']),
  'move-down': Object.freeze(['ArrowDown', 'KeyS']),
  'move-left': Object.freeze(['ArrowLeft', 'KeyA']),
  'move-right': Object.freeze(['ArrowRight', 'KeyD']),
  pause: Object.freeze(['Escape', 'KeyP']),
  restart: Object.freeze(['KeyR']),
});

export const ACTION_LABELS = Object.freeze({
  'move-up': 'Move up',
  'move-down': 'Move down',
  'move-left': 'Move left',
  'move-right': 'Move right',
  pause: 'Pause or resume',
  restart: 'Restart game',
});

const assertAction = (action) => {
  if (!INPUT_ACTIONS.includes(action)) throw new TypeError(`Unknown input action: ${action}`);
};

function normalizeBindings(bindings) {
  const normalized = {};
  for (const action of INPUT_ACTIONS) {
    const codes = bindings[action] ?? [];
    if (!Array.isArray(codes) || codes.some((code) => typeof code !== 'string')) {
      throw new TypeError(`Bindings for ${action} must be an array of KeyboardEvent.code values`);
    }
    normalized[action] = [...new Set(codes)];
  }
  return normalized;
}

/**
 * Action-based keyboard and touch input. It deliberately does not mutate GameState;
 * state systems consume actions through onAction or the query methods.
 *
 * @param {Object} [options]
 * @param {Document|HTMLElement} [options.keyboardTarget=document]
 * @param {HTMLElement|null} [options.touchRoot=null] Element containing [data-action] controls.
 * @param {Record<string, string[]>} [options.bindings=DEFAULT_KEY_BINDINGS]
 * @param {(event: {action: string, active: boolean, source: 'keyboard'|'touch'}) => void} [options.onAction]
 * @returns {{attach: () => void, detach: () => void, clear: () => void, isActive: (action: string) => boolean, getDirection: () => {x: number, z: number}, getBindings: () => Record<string, string[]>, setBindings: (bindings: Record<string, string[]>) => void}}
 */
export function createInputController(options = {}) {
  const keyboardTarget = options.keyboardTarget ?? document;
  const touchRoot = options.touchRoot ?? null;
  const onAction = options.onAction ?? (() => {});
  let bindings = normalizeBindings(options.bindings ?? DEFAULT_KEY_BINDINGS);
  const activeSources = new Map(INPUT_ACTIONS.map((action) => [action, new Set()]));
  const heldCodes = new Map();
  const pointerActions = new Map();
  let attached = false;

  const emitIfChanged = (action, source, token, active) => {
    const sources = activeSources.get(action);
    const wasActive = sources.size > 0;
    if (active) sources.add(token); else sources.delete(token);
    const isActive = sources.size > 0;
    if (isActive !== wasActive) onAction({ action, active: isActive, source });
  };

  const actionForCode = (code) => INPUT_ACTIONS.find((action) => bindings[action].includes(code));

  const onKeyDown = (event) => {
    const action = actionForCode(event.code);
    if (!action || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (heldCodes.has(event.code)) return;
    heldCodes.set(event.code, action);
    emitIfChanged(action, 'keyboard', `key:${event.code}`, true);
  };

  const onKeyUp = (event) => {
    const action = heldCodes.get(event.code);
    if (!action) return;
    event.preventDefault();
    heldCodes.delete(event.code);
    emitIfChanged(action, 'keyboard', `key:${event.code}`, false);
  };

  const clear = () => {
    for (const action of INPUT_ACTIONS) {
      const sources = activeSources.get(action);
      if (sources.size) {
        sources.clear();
        onAction({ action, active: false, source: 'keyboard' });
      }
    }
    heldCodes.clear();
    pointerActions.clear();
  };

  const onVisibilityChange = () => {
    if (document.hidden) clear();
  };

  const getTouchButton = (event) => event.target instanceof Element
    ? event.target.closest('[data-action]')
    : null;

  const onPointerDown = (event) => {
    const button = getTouchButton(event);
    if (!button || !touchRoot?.contains(button)) return;
    const action = button.dataset.action;
    assertAction(action);
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    pointerActions.set(event.pointerId, action);
    emitIfChanged(action, 'touch', `pointer:${event.pointerId}`, true);
  };

  const releasePointer = (event) => {
    const action = pointerActions.get(event.pointerId);
    if (!action) return;
    event.preventDefault();
    pointerActions.delete(event.pointerId);
    emitIfChanged(action, 'touch', `pointer:${event.pointerId}`, false);
  };

  const onTouchKey = (event) => {
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    const button = getTouchButton(event);
    if (!button || !touchRoot?.contains(button)) return;
    const action = button.dataset.action;
    assertAction(action);
    event.preventDefault();
    const token = `button:${action}`;
    emitIfChanged(action, 'touch', token, event.type === 'keydown');
  };

  const prepareTouchControls = () => {
    touchRoot?.querySelectorAll('[data-action]').forEach((button) => {
      const action = button.dataset.action;
      assertAction(action);
      button.setAttribute('aria-label', button.getAttribute('aria-label') || ACTION_LABELS[action]);
      button.setAttribute('title', button.getAttribute('title') || ACTION_LABELS[action]);
      if (!button.hasAttribute('tabindex') && button.tagName !== 'BUTTON') button.tabIndex = 0;
      if (button.tagName !== 'BUTTON' && !button.hasAttribute('role')) button.setAttribute('role', 'button');
    });
  };

  const attach = () => {
    if (attached) return;
    attached = true;
    prepareTouchControls();
    keyboardTarget.addEventListener('keydown', onKeyDown);
    keyboardTarget.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', onVisibilityChange);
    touchRoot?.addEventListener('pointerdown', onPointerDown);
    touchRoot?.addEventListener('pointerup', releasePointer);
    touchRoot?.addEventListener('pointercancel', releasePointer);
    touchRoot?.addEventListener('lostpointercapture', releasePointer);
    touchRoot?.addEventListener('keydown', onTouchKey);
    touchRoot?.addEventListener('keyup', onTouchKey);
  };

  const detach = () => {
    if (!attached) return;
    attached = false;
    keyboardTarget.removeEventListener('keydown', onKeyDown);
    keyboardTarget.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', clear);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    touchRoot?.removeEventListener('pointerdown', onPointerDown);
    touchRoot?.removeEventListener('pointerup', releasePointer);
    touchRoot?.removeEventListener('pointercancel', releasePointer);
    touchRoot?.removeEventListener('lostpointercapture', releasePointer);
    touchRoot?.removeEventListener('keydown', onTouchKey);
    touchRoot?.removeEventListener('keyup', onTouchKey);
    clear();
  };

  return {
    attach,
    detach,
    clear,
    isActive(action) {
      assertAction(action);
      return activeSources.get(action).size > 0;
    },
    getDirection() {
      return {
        x: Number(activeSources.get('move-right').size > 0) - Number(activeSources.get('move-left').size > 0),
        z: Number(activeSources.get('move-down').size > 0) - Number(activeSources.get('move-up').size > 0),
      };
    },
    getBindings: () => Object.fromEntries(INPUT_ACTIONS.map((action) => [action, [...bindings[action]]])),
    setBindings(nextBindings) {
      clear();
      bindings = normalizeBindings(nextBindings);
    },
  };
}

/* ============================================================
   usuario.js — Input do jogador → intent
   ============================================================ */
window.UserInput = (() => {

  const state = {
    keys: {}, justPressed: {},
    keyDownAt: {},
    mouseDownAt: {},
    mouseJustPressed: {},
    mouseJustReleased: {},
    mouseReleaseDuration: {},
    mouseX: 0, mouseY: 0,
    worldX: 0, worldY: 0,
    mouseDown: false, rightDown: false
  };

  function bind(canvas) {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!state.keys[k]) {
        state.justPressed[k] = true;
        state.keyDownAt[k] = performance.now();
      }
      state.keys[k] = true;
      if (['w','a','s','d','q','e','r','z','x','c','v','f','t','g','b','y','h','shift',' '].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      state.keys[key] = false;
      delete state.keyDownAt[key];
    });
    window.addEventListener('blur', () => {
      state.keys = {};
      state.keyDownAt = {};
    });

    if (canvas) {
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        state.mouseX = e.clientX - r.left;
        state.mouseY = e.clientY - r.top;
      });
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0 && !state.mouseDown) {
          state.mouseDown = true;
          state.mouseDownAt.lmb = performance.now();
          state.mouseJustPressed.lmb = true;
        }
        if (e.button === 2 && !state.rightDown) {
          state.rightDown = true;
          state.mouseDownAt.rmb = performance.now();
          state.mouseJustPressed.rmb = true;
        }
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    window.addEventListener('mouseup', (e) => {
      const key = e.button === 0 ? 'lmb' : e.button === 2 ? 'rmb' : null;
      if (!key) return;
      const wasDown = key === 'lmb' ? state.mouseDown : state.rightDown;
      if (!wasDown) return;
      if (key === 'lmb') state.mouseDown = false;
      else state.rightDown = false;
      state.mouseJustReleased[key] = true;
      state.mouseReleaseDuration[key] = Math.max(0, (performance.now() - (state.mouseDownAt[key] || performance.now())) / 1000);
      delete state.mouseDownAt[key];
    });
  }

  function updateWorldMouse(camera, CX, CY) {
    state.worldX = camera.x + (state.mouseX - CX) / camera.zoom;
    state.worldY = camera.y + (state.mouseY - CY) / camera.zoom;
  }

  function readIntent(fighter) {
    const intent = {
      moveX: 0, moveY: 0,
      aimAngle: Math.atan2(state.worldY - fighter.y, state.worldX - fighter.x),
      mouseWorldX: state.worldX,
      mouseWorldY: state.worldY,
      actions: new Set(),
      heldActions: new Set(),
      holdTimes: {},
      releasedActions: new Set(),
      releaseTimes: {},
      justPressedActions: new Set()
    };

    if (state.keys['w']) intent.moveY -= 1;
    if (state.keys['s']) intent.moveY += 1;
    if (state.keys['a']) intent.moveX -= 1;
    if (state.keys['d']) intent.moveX += 1;

    // Contínuos
    if (state.mouseDown) {
      intent.actions.add('ataque_basico');
      intent.heldActions.add('ataque_basico');
      intent.holdTimes.ataque_basico = Math.max(0, (performance.now() - state.mouseDownAt.lmb) / 1000);
    }
    if (state.rightDown) {
      intent.actions.add('ataque_secundario');
      intent.heldActions.add('ataque_secundario');
      intent.holdTimes.ataque_secundario = Math.max(0, (performance.now() - state.mouseDownAt.rmb) / 1000);
    }
    if (state.mouseJustPressed.lmb) intent.justPressedActions.add('ataque_basico');
    if (state.mouseJustPressed.rmb) intent.justPressedActions.add('ataque_secundario');
    if (state.mouseJustReleased.lmb) {
      intent.releasedActions.add('ataque_basico');
      intent.releaseTimes.ataque_basico = state.mouseReleaseDuration.lmb;
    }
    if (state.mouseJustReleased.rmb) {
      intent.releasedActions.add('ataque_secundario');
      intent.releaseTimes.ataque_secundario = state.mouseReleaseDuration.rmb;
    }
    if (state.keys['q']) intent.actions.add('escudo');
    if (state.keys['shift']) intent.actions.add('charge');
    if (state.keys['r']) intent.actions.add('meditar');

    const heldAbilities = {
      z: 'skill_z', x: 'skill_x', c: 'skill_c', v: 'skill_v',
      g: 'transform_g', b: 'transform_b', y: 'ult1', h: 'ult2'
    };
    const now = performance.now();
    for (const [key, action] of Object.entries(heldAbilities)) {
      if (!state.keys[key]) continue;
      intent.heldActions.add(action);
      intent.holdTimes[action] = Math.max(0, (now - state.keyDownAt[key]) / 1000);
    }
    if (state.keys['q']) intent.heldActions.add('escudo');

    // Tap actions and the initial edge of holdable skills.
    const j = state.justPressed;
    if (j['e']) intent.actions.add('dash');
    if (j['f']) intent.actions.add('parry');
    for (const action of Object.values(heldAbilities)) {
      if (intent.heldActions.has(action) && Object.keys(heldAbilities).some(key => j[key] && heldAbilities[key] === action)) {
        intent.actions.add(action);
        intent.justPressedActions.add(action);
      }
    }
    if (j['t']) intent.actions.add('transform_t');
    if (j['g']) intent.actions.add('transform_g');
    if (j['b']) intent.actions.add('transform_b');
    if (j['y']) intent.actions.add('ult1');
    if (j['h']) intent.actions.add('ult2');
    for (const key of ['t', 'g', 'b', 'y', 'h']) {
      if (j[key]) intent.justPressedActions.add(({ t: 'transform_t', g: 'transform_g', b: 'transform_b', y: 'ult1', h: 'ult2' })[key]);
    }

    return intent;
  }

  function endFrame() {
    state.justPressed = {};
    state.mouseJustPressed = {};
    state.mouseJustReleased = {};
    state.mouseReleaseDuration = {};
  }

  return { bind, readIntent, updateWorldMouse, state, endFrame };
})();
/* ============================================================
   fx.js — Cinematic timing, camera focus and impact shake
   ============================================================ */
window.BattleFX = (() => {
  let cinematic = null;
  let shake = 0;
  let slowMo = { timer: 0, duration: 0, scale: 1 };
  let slowMoEnabled = true;
  let shakeScale = 1;
  let focusEnabled = true;

  function startCinematic(owner, duration = 2.5) {
    cinematic = { owner, timer: 0, duration };
    const overlay = document.getElementById('cineOverlay');
    if (overlay) overlay.classList.add('active');
    addShake(32);
  }

  function endCinematic(owner) {
    if (owner && cinematic && cinematic.owner !== owner) return;
    cinematic = null;
    const overlay = document.getElementById('cineOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  function addShake(amount) {
    shake = Math.max(shake, amount * shakeScale);
  }

  function triggerSlowMo(scale, duration) {
    slowMo = { timer: duration, duration, scale };
  }

  function update(dt) {
    if (cinematic) {
      cinematic.timer += dt;
      const owner = cinematic.owner;
      const actionActive = owner && (
        owner.specialActive || owner.skillActive || owner.ultimate ||
        owner.state === 'superdash' || owner.state === 'vline' ||
        owner.state === 'combo24'
      );
      if (!actionActive && cinematic.timer >= cinematic.duration) endCinematic();
    }
    shake *= Math.pow(0.001, dt);
    if (shake < 0.3) shake = 0;
    if (slowMo.timer > 0) slowMo.timer = Math.max(0, slowMo.timer - dt);
    if (!slowMoEnabled) return 1;
    if (slowMo.timer > 0) return slowMo.scale;
    return cinematic ? 0.35 : 1;
  }

  function configure(options = {}) {
    if (Number.isFinite(options.shake)) shakeScale = Math.max(0, Math.min(1, options.shake));
    if (typeof options.slowMo === 'boolean') slowMoEnabled = options.slowMo;
    if (typeof options.focus === 'boolean') focusEnabled = options.focus;
    if (!slowMoEnabled) slowMo = { timer: 0, duration: 0, scale: 1 };
  }
  function getShake() { return shake; }
  function getFocus() { return cinematic && focusEnabled ? cinematic.owner : null; }

  function reset() {
    endCinematic();
    shake = 0;
    slowMo = { timer: 0, duration: 0, scale: 1 };
  }

  return { startCinematic, endCinematic, addShake, triggerSlowMo, configure, update, getShake, getFocus, reset };
})();

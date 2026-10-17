window.createBattlePanel = function (scope) {
  with (scope) {
  function updateControlButtons() {
    const blueButton = document.getElementById('takeBlueControl');
    const redButton = document.getElementById('takeRedControl');
    if (blueButton && blueF) blueButton.textContent = blueF.isPlayer ? 'Devolver azul à IA' : 'Assumir controle (azul)';
    if (redButton && redF) redButton.textContent = redF.isPlayer ? 'Devolver vermelho à IA' : 'Assumir controle (vermelho)';
  }

  function bindHUDControls() {
    const blueButton = document.getElementById('takeBlueControl');
    const redButton = document.getElementById('takeRedControl');
    if (blueButton) blueButton.addEventListener('click', () => BattleGame.toggleControl('blue'));
    if (redButton) redButton.addEventListener('click', () => BattleGame.toggleControl('red'));
    const pauseInput = document.getElementById('debugPause');
    if (pauseInput) pauseInput.addEventListener('change', () => { state.debugPaused = pauseInput.checked; });
    const stepButton = document.getElementById('debugStep');
    if (stepButton) stepButton.addEventListener('click', () => {
      state.debugPaused = true;
      state.debugStep = true;
      if (pauseInput) pauseInput.checked = true;
    });
    const positionButton = document.getElementById('debugResetPositions');
    if (positionButton) positionButton.addEventListener('click', () => BattleGame.resetPositions());
    const forceButton = document.getElementById('debugForceX');
    if (forceButton) forceButton.addEventListener('click', () => BattleGame.forceSkillX());
    const bindings = [
      ['debugDisableEnemy', 'disableEnemyAI'],
      ['debugInfiniteUser', 'infiniteUser'],
      ['debugInfiniteAI', 'infiniteAI'],
      ['debugInvulnerableUser', 'invulnerableUser'],
      ['debugInvulnerableAI', 'invulnerableAI'],
      ['debugHitboxes', 'showHitboxes'],
      ['debugStatsToggle', 'showStats']
    ];
    for (const [id, key] of bindings) {
      const input = document.getElementById(id);
      if (input) input.addEventListener('change', () => { debug[key] = input.checked; });
    }
  }

  function updatePresetButtons(name) {
    document.querySelectorAll('[data-preset]').forEach(button => {
      button.classList.toggle('active', button.dataset.preset === name);
    });
  }

  function bindDebugControls() {
    window.addEventListener('keydown', (event) => {
      if (event.key === 'F12') {
        event.preventDefault();
        debug.open = !debug.open;
        if (debug.open) window.openBattleConfigTab('debug');
        else document.getElementById('cfgPanel')?.classList.remove('open');
      } else if (event.key.toLowerCase() === 'p' && debug.open) {
        state.debugPaused = !state.debugPaused;
        const pauseInput = document.getElementById('debugPause');
        if (pauseInput) pauseInput.checked = state.debugPaused;
      } else if (event.key.toLowerCase() === 'n' && debug.open && state.debugPaused) {
        state.debugStep = true;
      } else if (event.key === 'Home' && debug.open) {
        BattleGame.resetPositions();
      } else if (event.key === 'F9' && debug.open) {
        BattleGame.forceSkillX();
      }
    });
  }

    return { updateControlButtons, bindHUDControls, updatePresetButtons, bindDebugControls };
  }
};

window.createBattleHUD = function (scope) {
  with (scope) {
  function updateHUD() {
    if (!blueF || !redF) return;
    const setW = (id, pct) => { const e = document.getElementById(id); if (e) e.style.width = pct + '%'; };
    setW('hpBlue', (blueF.hp / blueF.maxHp) * 100);
    setW('hpRed', (redF.hp / redF.maxHp) * 100);
    setW('manaBlue', blueF.maxMana ? (blueF.mana / blueF.maxMana) * 100 : 0);
    setW('manaRed', redF.maxMana ? (redF.mana / redF.maxMana) * 100 : 0);
    const manaBlueBar = document.getElementById('manaBarBlue');
    const manaRedBar = document.getElementById('manaBarRed');
    if (manaBlueBar) manaBlueBar.hidden = !blueF.maxMana;
    if (manaRedBar) manaRedBar.hidden = !redF.maxMana;
    setW('staminaBlue', Math.min(100, (blueF.stamina / blueF.maxStamina) * 100));
    setW('staminaRed', Math.min(100, (redF.stamina / redF.maxStamina) * 100));
    setW('eterBlue', blueF.maxEter ? (blueF.eter / blueF.maxEter) * 100 : 0);
    setW('eterRed', redF.maxEter ? (redF.eter / redF.maxEter) * 100 : 0);
    const eterBlueBar = document.getElementById('eterBarBlue');
    const eterRedBar = document.getElementById('eterBarRed');
    if (eterBlueBar) eterBlueBar.hidden = !blueF.maxEter;
    if (eterRedBar) eterRedBar.hidden = !redF.maxEter;
    const bN = document.getElementById('blueName'); if (bN) bN.textContent = blueF.name || 'Azul';
    const rN = document.getElementById('redName'); if (rN) rN.textContent = redF.name || 'Vermelho';
    const bC = document.getElementById('blueClass'); if (bC) bC.textContent = `${blueF.classCfg.name} · L${blueF.aiLevel}`;
    const rC = document.getElementById('redClass'); if (rC) rC.textContent = `${redF.classCfg.name} · L${redF.aiLevel}`;
    updateFighterHUD('blue', blueF);
    updateFighterHUD('red', redF);
    const score = document.getElementById('spectatorScore');
    if (score) {
      const blueLead = blueF.hp - redF.hp;
      const leader = Math.abs(blueLead) < 0.5 ? 'EMPATE' : blueLead > 0 ? 'AZUL NA FRENTE' : 'VERMELHO NA FRENTE';
      score.hidden = blueF.isPlayer || redF.isPlayer;
      score.textContent = `${leader} · AZUL ${Math.ceil(blueF.hp)} HP — ${Math.ceil(redF.hp)} HP VERMELHO · ${state.time.toFixed(1)}s`;
    }
    const stats = document.getElementById('debugStats');
    if (stats) {
      stats.hidden = !debug.showStats;
      if (debug.showStats) {
      const particles = Registro.obterEfeito('particula').itens.length;
      const entities = 2 + Projectiles.list.length + Minions.units.length + particles;
      stats.textContent = `FPS ${state.fps.toFixed(0)} · frame ${state.frameMs.toFixed(1)}ms · partículas ${particles} · entidades ${entities} · projéteis ${Projectiles.list.length} · ${state.time.toFixed(1)}s`;
    }
    }
  }
  function updateFighterHUD(prefix, fighter) {
    const status = document.getElementById(`${prefix}Status`);
    if (status) {
      const labels = Object.keys(fighter.statuses).map(id => `${STATUS[id].label} ${fighter.statuses[id].t.toFixed(0)}s`);
      if (fighter.awakeningT > 0) labels.push(`DESPERTO ${fighter.awakeningT.toFixed(0)}s`);
      if (fighter.speedPenaltyT > 0) labels.push(`LENTO ${fighter.speedPenaltyT.toFixed(0)}s`);
      if (fighter.stunTime > 0) labels.push('STUN');
      labels.push(...(fighter.classCfg.hudExtras?.(fighter) || []));
      status.textContent = labels.join(' · ');
    }
    const cooldowns = document.getElementById(`${prefix}Cooldowns`);
    if (!cooldowns) return;
    const keys = [
      ['Z', 'skill_z'], ['X', 'skill_x'], ['C', 'skill_c'], ['V', 'skill_v'],
      ['T', 'transform_t'], ['G', 'transform_g'], ['B', 'transform_b'],
      ['Y', 'ult1'], ['H', 'ult2'], ['E', 'dash'], ['F', 'parry']
    ];
    cooldowns.innerHTML = keys.filter(([label]) => {
      const ability = label === 'E' ? 'dash' : label === 'F' ? 'parry' : label.toLowerCase();
      return !fighter.abilityModes || fighter.abilityModes[ability] !== 'hidden';
    }).map(([label, key]) => {
      const remaining = Math.max(0, fighter.cd[key] || 0);
      const hasCharges = label === 'X' && fighter.classKey === 'espadachim';
      const value = hasCharges && fighter.xCharges > 0
        ? `${fighter.xCharges}/3`
        : remaining > 0 ? `${Math.ceil(remaining)}s` : label;
      const ready = remaining <= 0 && (!hasCharges || fighter.xCharges > 0) ? ' ready' : '';
      const active = fighter.ultimate &&
        ((key === 'ult1' && fighter.ultimate.slot === 'y') ||
        (key === 'ult2' && fighter.ultimate.slot === 'h')) ? ' active' : '';
      return `<span class="cooldown${ready}${active}" title="${label}">${value}</span>`;
    }).join('');
  }

    return { updateHUD, updateFighterHUD };
  }
};

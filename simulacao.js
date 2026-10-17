/* ============================================================
   simulacao.js — Loop e orquestração de combate
   ============================================================ */
(function () {
  const { PARAMS, STATUS, WORLD, HABILIDADES } = window.BattleData;
  const Classes = window.Classes = {};
  const Projectiles = window.Projectiles;
  const BattleFX = window.BattleFX;

  let canvas, ctx, W, H, CX, CY;
  let running = false;
  let last = 0;
  let restartTimer = null;

  const DEFAULT_CONFIG = {
    personagens: {
      azul: { classe: 'espadachim', nivel: 3, jogador: false, reflexo: 65, variant: 'padrao', nome: 'Azul', cor: '' },
      vermelho: { classe: 'mage', nivel: 5, jogador: false, reflexo: 65, variant: 'padrao', nome: 'Vermelho', cor: '' }
    },
    habilidades: { azul: {}, vermelho: {} },
    efeitos: { shake: 100, flash: true, slowMo: false, focus: true, particulas: 100, trail: true },
    camera: { zoom: 85, tracking: 4, focus: true },
    mundo: { cenario: 'grid', estrelas: 100, borda: true, cor: 220, tamanho: 100 },
    recursos: {
      vida: { max: 100, regen: 100 },
      mana: { max: 100, regen: 100 },
      stamina: { max: 100, regen: 100 },
      eter: { max: 100, regen: 100 }
    }
  };
  const ABILITY_KEYS = ['basic', 'secondary', 'z', 'x', 'c', 'v', 't', 'g', 'b', 'y', 'h', 'dash', 'parry', 'shield', 'charge', 'meditate'];
  for (const side of ['azul', 'vermelho']) {
    for (const key of ABILITY_KEYS) DEFAULT_CONFIG.habilidades[side][key] = 'unlocked';
  }
  const CONFIG_KEY = 'batalha_config_v2';
  let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  const state = {
    time: 0, timeScale: 1,
    combo: 0, comboTimeout: 0,
    timeStop: { owner: null, timer: 0 },
    debugPaused: false, debugStep: false,
    frameMs: 0, fps: 0
  };
  const debug = {
    open: false, disableEnemyAI: false,
    infiniteUser: false, infiniteAI: false,
    invulnerableUser: false, invulnerableAI: false, forceSkillX: false, bypassSkillX: null,
    showHitboxes: false, showStats: false
  };

  const camera = {
    x: WORLD.w / 2, y: WORLD.h / 2, zoom: 0.7, shakeX: 0, shakeY: 0,
    zoomMul: 0.85, tracking: 4, focusEnabled: true
  };

  let blueF = null, redF = null;

  const ABILITY_ACTIONS = {
    basic: ['ataque_basico'], secondary: ['ataque_secundario'],
    z: ['skill_z'], x: ['skill_x'], c: ['skill_c'], v: ['skill_v'],
    t: ['transform_t'], g: ['transform_g'], b: ['transform_b'],
    y: ['ult1'], h: ['ult2'], dash: ['dash'], parry: ['parry'],
    shield: ['escudo'], charge: ['charge'], meditate: ['meditar']
  };
  const WORLD_STARS = Array.from({ length: 200 }, (_, i) => ({
    x: ((i * 7919) % 997) / 997 * WORLD.w,
    y: ((i * 104729) % 991) / 991 * WORLD.h,
    size: 0.7 + (i % 5) * 0.35,
    alpha: 0.25 + (i % 7) * 0.09
  }));
  let hud, world, render, panel;
  const runtimeScope = {
    PARAMS, Classes, STATUS, WORLD, HABILIDADES,
    Projectiles, BattleFX, DEFAULT_CONFIG, ABILITY_KEYS, CONFIG_KEY,
    state, debug, camera, ABILITY_ACTIONS, WORLD_STARS,
    get config() { return config; },
    set config(value) { config = value; },
    get blueF() { return blueF; },
    get redF() { return redF; },
    get ctx() { return ctx; },
    get W() { return W; },
    get H() { return H; },
    get BattleGame() { return BattleGame; },
    get updateHUD() { return hud.updateHUD; },
    get updateControlButtons() { return panel.updateControlButtons; },
    get updatePresetButtons() { return panel.updatePresetButtons; },
    getDebugUser, getDebugEnemy, isDebugUser, isDebugInvulnerable, applyDebugResources,
    startMove, finishMove, reflectProjectile, reflectProjectiles, destroyProjectiles, destroyProjectilesAlong,
    Minions: window.Minions,
    spawnParticle, addExplosion, flash, updateCombo, startCinematic, endCinematic
  };
  Classes.espadachim = window.createBattleSwordsman(runtimeScope);
  Classes.arqueiro = window.createBattleArcher(runtimeScope);
  Classes.mage = window.createBattleMage(runtimeScope);
  Classes.invocador = window.createBattleInvoker(runtimeScope);
  const BattleConfig = window.createBattleConfig(runtimeScope);
  hud = window.createBattleHUD(runtimeScope);
  world = window.createBattleWorld(runtimeScope);
  render = window.createBattleRender(runtimeScope);
  panel = window.createBattlePanel(runtimeScope);

  // ============ HELPERS ============
  function getDebugUser() {
    if (blueF && blueF.isPlayer) return blueF;
    if (redF && redF.isPlayer) return redF;
    return blueF;
  }
  function getDebugEnemy() {
    const user = getDebugUser();
    return user === blueF ? redF : blueF;
  }
  function isDebugUser(fighter) { return fighter === getDebugUser(); }
  function isDebugInvulnerable(fighter) {
    return isDebugUser(fighter) ? debug.invulnerableUser : debug.invulnerableAI;
  }
  function applyDebugResources(fighter) {
    const enabled = isDebugUser(fighter) ? debug.infiniteUser : debug.infiniteAI;
    if (!enabled) return;
    fighter.stamina = fighter.maxStamina;
    fighter.mana = fighter.maxMana;
    fighter.resources.fill();
    fighter.arcaneBarrierCooldown = 0;
    for (const key in fighter.cd) fighter.cd[key] = 0;
  }
  function moveCooldownKey(slot) {
    return ({ z: 'skill_z', x: 'skill_x', c: 'skill_c', v: 'skill_v', t: 'transform_t',
      g: 'transform_g', b: 'transform_b', y: 'ult1', h: 'ult2' })[slot];
  }
  function startMove(fighter, slot, opponent, options) {
    const cooldownKey = moveCooldownKey(slot);
    const fallback = cooldownKey && HABILIDADES[cooldownKey];
    const cost = options.cost === undefined ? (fallback ? fallback.custo : {}) : options.cost;
    if (!fighter.canPayResources(cost)) return false;
    fighter.spendResources(cost);
    if (cooldownKey) fighter.cd[cooldownKey] = options.cooldown === undefined
      ? (fallback ? fallback.cd : 0)
      : options.cooldown;
    fighter.skillData = {
      slot, opponent, elapsed: 0, holdElapsed: 0,
      startedHeld: !!cooldownKey && fighter.heldActions.has(options.holdAction || cooldownKey),
      ...options.data
    };
    fighter.skillActive = true;
    fighter.state = 'skill';
    fighter.timer = 0;
    fighter.recoveryDuration = options.recovery || 0.15;
    if (slot === 'y' || slot === 'h') {
      fighter.ultimate = {
        slot, elapsed: 0, phase: 'charge', angle: fighter.aimAngle,
        hit: false, tick: 0, count: 0
      };
    }
    return true;
  }
  function finishMove(fighter, recovery) {
    fighter.skillActive = false;
    fighter.skillData = null;
    fighter.ultimate = null;
    fighter.state = 'recover';
    fighter.timer = 0;
    fighter.recoveryDuration = recovery === undefined ? 0.15 : recovery;
    endCinematic(fighter);
  }
  function reflectProjectile(projectile, fighter, multiplier = 1.5) {
    if (!projectile || projectile.owner === fighter || projectile.deflected || !projectile.owner) return false;
    const oldOwner = projectile.owner;
    const angle = Math.atan2(oldOwner.y - fighter.y, oldOwner.x - fighter.x);
    const speed = Math.hypot(projectile.vx, projectile.vy);
    projectile.owner = fighter;
    projectile.vx = Math.cos(angle) * speed * multiplier;
    projectile.vy = Math.sin(angle) * speed * multiplier;
    projectile.damage *= multiplier;
    projectile.homing = 0;
    projectile.deflected = true;
    projectile.reflect = true;
    return true;
  }
  function reflectProjectiles(fighter, radius, angle = fighter.aimAngle, halfAngle = Math.PI) {
    let reflected = 0;
    for (const projectile of Projectiles.list) {
      const dx = projectile.x - fighter.x, dy = projectile.y - fighter.y;
      if (Math.hypot(dx, dy) > radius) continue;
      let relative = Math.atan2(dy, dx) - angle;
      while (relative > Math.PI) relative -= Math.PI * 2;
      while (relative < -Math.PI) relative += Math.PI * 2;
      if (Math.abs(relative) <= halfAngle && reflectProjectile(projectile, fighter)) reflected++;
    }
    return reflected;
  }
  function destroyProjectiles(fighter, radius, angle = null, halfAngle = Math.PI) {
    let destroyed = 0;
    for (let i = Projectiles.list.length - 1; i >= 0; i--) {
      const projectile = Projectiles.list[i];
      if (projectile.owner === fighter) continue;
      const dx = projectile.x - fighter.x, dy = projectile.y - fighter.y;
      if (Math.hypot(dx, dy) > radius) continue;
      if (angle !== null) {
        let relative = Math.atan2(dy, dx) - angle;
        while (relative > Math.PI) relative -= Math.PI * 2;
        while (relative < -Math.PI) relative += Math.PI * 2;
        if (Math.abs(relative) > halfAngle) continue;
      }
      addExplosion(projectile.x, projectile.y, fighter.hue, 0.25, false);
      Projectiles.list.splice(i, 1);
      destroyed++;
    }
    return destroyed;
  }
  function destroyProjectilesAlong(x1, y1, x2, y2, radius, fighter) {
    const sx = x2 - x1, sy = y2 - y1;
    const lengthSquared = sx * sx + sy * sy || 1;
    let destroyed = 0;
    for (let i = Projectiles.list.length - 1; i >= 0; i--) {
      const projectile = Projectiles.list[i];
      if (projectile.owner.side === fighter.side) continue;
      const projection = Math.max(0, Math.min(1, ((projectile.x - x1) * sx + (projectile.y - y1) * sy) / lengthSquared));
      const distance = Math.hypot(projectile.x - (x1 + sx * projection), projectile.y - (y1 + sy * projection));
      if (distance > radius + projectile.radius) continue;
      addExplosion(projectile.x, projectile.y, fighter.hue, 0.3, false);
      Projectiles.list.splice(i, 1);
      destroyed++;
    }
    return destroyed;
  }
  function spawnParticle(x, y, vx, vy, hue, size, decay, light = 75) {
    if (Math.random() > config.efeitos.particulas / 100) return;
    return window.Registro.obterEfeito('particula').criar({ x, y, vx, vy, hue, size, decay, light });
  }
  function addExplosion(x, y, hue, power = 1, big = false) {
    return window.Registro.obterEfeito('explosao').criar({ x, y, hue, power, big, spawnParticle });
  }
  function flash() {
    if (!config.efeitos.flash) return;
    const el = document.getElementById('flash');
    if (!el) return;
    el.style.transition = 'none'; el.style.opacity = '0.9';
    requestAnimationFrame(() => { el.style.transition = 'opacity 0.5s'; el.style.opacity = '0'; });
  }
  function updateCombo() {
    const el = document.getElementById('combo');
    if (!el) return;
    if (state.combo > 1) { el.textContent = `x${state.combo} COMBO`; el.classList.add('show'); }
  }
  function startCinematic(owner, duration = 2.5) {
    BattleFX.startCinematic(owner, duration);
  }
  function endCinematic(owner) {
    BattleFX.endCinematic(owner);
  }

  // ============ FIGHTER ============
  const Fighter = window.createBattleFighter(runtimeScope);
  for (const FighterParts of [
    window.createBattleFighterActions(runtimeScope),
    window.createBattleFighterState(runtimeScope)
  ]) {
    for (const name of Object.getOwnPropertyNames(FighterParts.prototype)) {
      if (name !== 'constructor') {
        Object.defineProperty(Fighter.prototype, name,
          Object.getOwnPropertyDescriptor(FighterParts.prototype, name));
      }
    }
  }


  // ============ UPDATES ============
  function updateProjectiles(dt) {
    for (let i = Projectiles.list.length - 1; i >= 0; i--) {
      const p = Projectiles.list[i];
      if (p.dead) {
        Projectiles.list.splice(i, 1);
        continue;
      }
      if (p.impact) {
        p.trailLife -= dt;
        if (p.trailLife <= 0) Projectiles.list.splice(i, 1);
        continue;
      }
      const target = p.owner.side < 0 ? redF : blueF;
      p.update(dt, target);
      if (p.type === 'slash') {
        const sx = p.x - p.prevX, sy = p.y - p.prevY;
        const lengthSquared = sx * sx + sy * sy || 1;
        for (const other of Projectiles.list) {
          if (other === p || other.dead || other.owner.side === p.owner.side || !other.destructible) continue;
          const projection = Math.max(0, Math.min(1, ((other.x - p.prevX) * sx + (other.y - p.prevY) * sy) / lengthSquared));
          const distance = Math.hypot(other.x - (p.prevX + sx * projection), other.y - (p.prevY + sy * projection));
          if (distance <= p.radius + other.radius) {
            other.dead = true;
            addExplosion(other.x, other.y, p.hue, 0.35, false);
          }
        }
      }
      if (target.tryDeflectProjectile(p)) continue;
      if (Minions.intercept(p, target)) {
        addExplosion(p.x, p.y, p.hue, p.explosionRadius > 0 ? 1.2 : 0.35, p.explosionRadius > 0);
        if (p.type === 'slash') p.lingerAfterImpact();
        else Projectiles.list.splice(i, 1);
        continue;
      }

      // Colisão com alvo
      const sx = p.x - (p.prevX === undefined ? p.x : p.prevX);
      const sy = p.y - (p.prevY === undefined ? p.y : p.prevY);
      const segmentLength = sx * sx + sy * sy || 1;
      const projection = Math.max(0, Math.min(1, ((target.x - p.x + sx) * sx + (target.y - p.y + sy) * sy) / segmentLength));
      const d = Math.hypot(target.x - (p.x - sx + sx * projection), target.y - (p.y - sy + sy * projection));
      if (!p.hitTargets.has(target) && d < (target.bodyRadius || 40) + p.radius) {
        const damage = p.damage * (p.owner.classCfg?.projectileDamageMultiplier?.(p.owner, p) || 1);
        if (p.explosionRadius > 0) {
          addExplosion(p.x, p.y, p.hue, 1.2, true);
          if (Math.hypot(target.x - p.x, target.y - p.y) <= p.explosionRadius) {
            p.owner.applyHit(target, damage, Math.atan2(target.y - p.y, target.x - p.x), 220, 0.1, p.status, true, p.unblockable);
          }
        } else {
          p.owner.applyHit(target, damage, Math.atan2(p.vy, p.vx), 400, p.stun, p.status, false, p.unblockable);
          addExplosion(p.x, p.y, p.hue, 1);
        }
        p.hitTargets.add(target);
        if (!p.piercing) {
          if (p.type === 'slash') p.lingerAfterImpact();
          else Projectiles.list.splice(i, 1);
          continue;
        }
      }
      if (p.life <= 0 || p.x < -100 || p.x > WORLD.w + 100 || p.y < -100 || p.y > WORLD.h + 100) {
        if (p.type === 'slash') p.lingerAfterImpact();
        else Projectiles.list.splice(i, 1);
      }
    }
  }
  // HUD
  let hudTimer = 0;
  // LOOP
  function loop(now) {
    if (!running) return;
    if (state.debugPaused && !state.debugStep) {
      last = now;
      requestAnimationFrame(loop);
      return;
    }
    let dt = (now - last) / 1000; last = now;
    if (state.debugStep) {
      dt = 1 / 60;
      state.debugStep = false;
    }
    if (dt > 0.05) dt = 0.05;
    state.frameMs = dt * 1000;
    state.fps = dt > 0 ? 1 / dt : 0;

    if (state.timeStop.owner) {
      state.timeStop.timer += dt;
      if (state.timeStop.timer >= state.timeStop.duration || !state.timeStop.owner.ultimate) {
        state.timeStop = { owner: null, timer: 0, duration: 0 };
      }
    }
    const cinematicScale = BattleFX.update(dt);
    state.timeScale = state.timeStop.owner ? 0.2 : cinematicScale;
    const sdt = dt * state.timeScale;
    state.time += sdt;

    UserInput.updateWorldMouse(camera, CX, CY);

    const blueFrozen = state.timeStop.owner && state.timeStop.owner !== blueF;
    const redFrozen = state.timeStop.owner && state.timeStop.owner !== redF;
    applyDebugResources(blueF);
    applyDebugResources(redF);
    const disabledEnemy = debug.disableEnemyAI ? getDebugEnemy() : null;
    const passiveIntent = () => ({ moveX: 0, moveY: 0, moveVx: 0, moveVy: 0, aimAngle: 0, actions: new Set() });
    let blueIntent = blueFrozen ? null : (blueF.isPlayer
      ? UserInput.readIntent(blueF)
      : disabledEnemy === blueF ? passiveIntent() : AI.decide(blueF, redF, sdt, { projectiles: Projectiles.list, realDt: dt }));
    let redIntent = redFrozen ? null : (redF.isPlayer
      ? UserInput.readIntent(redF)
      : disabledEnemy === redF ? passiveIntent() : AI.decide(redF, blueF, sdt, { projectiles: Projectiles.list, realDt: dt }));

    if (debug.forceSkillX) {
      const fighter = getDebugUser();
      const intent = fighter === blueF ? blueIntent : redIntent;
      if (intent && ['idle', 'recover'].includes(fighter.state)) {
        fighter.cd.skill_x = 0;
        debug.bypassSkillX = fighter;
        intent.actions.clear();
        intent.actions.add('skill_x');
        debug.forceSkillX = false;
      }
    }

    if (blueIntent) blueF.applyIntent(sdt, blueIntent, redF);
    if (redIntent) redF.applyIntent(sdt, redIntent, blueF);

    blueF.update(blueFrozen ? 0 : sdt, redF);
    redF.update(redFrozen ? 0 : sdt, blueF);
    updateProjectiles(sdt);
    Minions.update(sdt, blueF, redF);
    window.Registro.atualizarEfeitos(sdt, runtimeScope);
    applyDebugResources(blueF);
    applyDebugResources(redF);

    if (state.comboTimeout > 0) {
      state.comboTimeout -= dt;
      if (state.comboTimeout <= 0) {
        state.combo = 0;
        const el = document.getElementById('combo');
        if (el) el.classList.remove('show');
      }
    }
    world.updateCamera(dt);

    if ((blueF.hp <= 0 || redF.hp <= 0) && restartTimer === null) {
      addExplosion((blueF.hp <= 0 ? redF.x : blueF.x), redF.y, 60, 3, true);
      restartTimer = setTimeout(() => {
        restartTimer = null;
        BattleGame.reset();
      }, 1500);
    }

    ctx.fillStyle = 'rgb(0,0,6)';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(CX, CY); ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x + camera.shakeX, -camera.y + camera.shakeY);

    world.drawWorld();

    Minions.draw(ctx);
    blueF.drawAimLine();
    blueF.draw(); redF.draw();
    window.Registro.desenharEfeitos(ctx, runtimeScope);
    render.drawProjectiles();
    render.drawDebugOverlay();
    ctx.restore();

    hudTimer += dt;
    if (hudTimer > 0.1) { hudTimer = 0; hud.updateHUD(); }

    UserInput.endFrame();
    requestAnimationFrame(loop);
  }

  // API
  const BattleGame = {
    init(opts = {}) {
      canvas = document.getElementById(opts.canvasId || 'game');
      if (!canvas) { console.error('Canvas não encontrado'); return; }
      ctx = canvas.getContext('2d', { alpha: false });
      resize();
      window.addEventListener('resize', resize);
      UserInput.bind(canvas);
      panel.bindDebugControls();
      panel.bindHUDControls();
      BattleConfig.bindConfigControls();
      BattleConfig.loadConfig();
      this.reset();
      running = true;
      last = performance.now();
      requestAnimationFrame(loop);
    },
    reset() {
      if (restartTimer !== null) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      BattleFX.reset();
      BattleConfig.applyConfigRuntime();
      state.timeStop = { owner: null, timer: 0, duration: 0 };
      state.timeScale = 1;
      state.debugPaused = false; state.debugStep = false;
      const pauseInput = document.getElementById('debugPause');
      if (pauseInput) pauseInput.checked = false;
      const stepButton = document.getElementById('debugStep');
      if (stepButton) stepButton.disabled = false;
      debug.forceSkillX = false;
      debug.bypassSkillX = null;
      window.Registro.limparEfeitos();
      Projectiles.clear();
      Minions.clear();
      blueF = new Fighter(-1, config.personagens.azul.classe, config.personagens.azul.jogador);
      redF = new Fighter(1, config.personagens.vermelho.classe, config.personagens.vermelho.jogador);
      state.combo = 0; state.comboTimeout = 0; state.time = 0;
      camera.x = WORLD.w / 2; camera.y = WORLD.h / 2; camera.zoom = 0.7;
      BattleConfig.applyConfigRuntime();
      panel.updateControlButtons();
      hud.updateHUD();
    },
    applyPreset: BattleConfig.applyPreset,
    resetAllConfig: BattleConfig.resetAllConfig,
    getConfig() { return JSON.parse(JSON.stringify(config)); },
    setDebugOpen(open) { debug.open = !!open; },
    importConfig(imported) {
      if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
        throw new TypeError('A configuração importada deve ser um objeto JSON.');
      }
      config = BattleConfig.normalizeConfig(imported);
      BattleConfig.applyConfigToControls();
      BattleConfig.applyConfigRuntime();
      BattleConfig.saveConfig();
      this.reset();
      panel.updatePresetButtons('');
    },
    toggleControl(side) {
      const fighter = side === 'red' ? redF : blueF;
      const other = side === 'red' ? blueF : redF;
      if (fighter.isPlayer) fighter.isPlayer = false;
      else {
        other.isPlayer = false;
        fighter.isPlayer = true;
      }
      panel.updateControlButtons();
      hud.updateHUD();
    },
    resetPositions() {
      if (!blueF || !redF) return;
      blueF.x = WORLD.w * 0.25; blueF.y = WORLD.h * 0.5;
      redF.x = WORLD.w * 0.75; redF.y = WORLD.h * 0.5;
      for (const fighter of [blueF, redF]) {
        fighter.vx = 0; fighter.vy = 0;
        fighter.knockbackVx = 0; fighter.knockbackVy = 0;
      }
    },
    forceSkillX() { debug.forceSkillX = true; },
    stop() { running = false; },
    getBlue() { return blueF; },
    getRed() { return redF; }
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    CX = W / 2; CY = H / 2;
  }

  window.BattleGame = BattleGame;
})();

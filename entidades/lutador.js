window.createBattleFighter = function (scope) {
  with (scope) {
    return class Fighter {
    constructor(side, classKey, isPlayer) {
      this.side = side;
      this.isPlayer = !!isPlayer;
      this.resources = new window.BattleResources();
      this.setClass(classKey);
      this.x = side < 0 ? WORLD.w * 0.2 : WORLD.w * 0.8;
      this.y = WORLD.h / 2;
      this.vx = 0; this.vy = 0;
      this.classCfg.onCreate?.(this);

      this.stamina = this.maxStamina;
      this.mana = this.maxMana || 0;

      // Cooldowns
      this.cd = {};
      for (const k in HABILIDADES) this.cd[k] = 0;

      // Estados
      this.state = 'idle';
      this.timer = 0;
      this.strikeStart = { x: 0, y: 0 };
      this.strikeT = 0;
      this.strikeAngle = 0;
      this.strikeRange = 200;
      this.strikeDamage = 0;
      this.strikeStun = 0;
      this.strikeDur = 0.10;
      this.strikeWindup = 0;
      this.strikeStatus = null;
      this.strikeApplyOnce = false;

      // Defesa
      this.blocking = false;
      this.arcaneBarrierCooldown = 0;
      this.parryWindow = 0;
      this.parryImmuneT = 0;
      this.immuneT = 0;
      this.dodgeT = 0;
      this.dodgeIframesT = 0;
      this.stunTime = 0;

      // STATUS — mapa { bleeding: {t}, burning: {t}, ... }
      this.statuses = {};

      this.knockbackVx = 0; this.knockbackVy = 0;
      this.aimAngle = 0;
      this.aura = 1;
      this.rage = 0;
      this.afterimages = [];
      this.elementIndex = 0;
      this.reflex = 0.65;
      this.aiLevel = 7;
      this.abilities = Object.fromEntries(ABILITY_KEYS.map(key => [key, false]));

      // Especiais
      this.specialActive = false;
      this.specialT = 0;
      this.specialData = null;
      this.skillActive = false;
      this.skillData = null;
      this.heldActions = new Set();
      this.holdTimes = {};
      this.basicAttack = null;
      this.recoveryDuration = 0.05;
      this.ultimate = null;
      this.awakeningT = 0;
      this.damageMultiplier = 1;
      this.speedPenaltyT = 0;
      this._awakenedDefense = 1;
    }

    setClass(key) {
      this.classKey = key;
      this.classCfg = Classes[key];
      if (!this.classCfg) throw new Error(`Classe de lutador desconhecida: ${key}`);
      this.hue = this.classCfg.hue;
      this.resistance = this.classCfg.stats.resistance;
      this.maxSpeed = this.classCfg.stats.maxSpeed;
      this.resources.define(this.resourceDefinitions(), config.recursos, false);
    }

    resourceDefinitions() {
      const classResources = this.classCfg.stats.resources;
      const regen = classResources.regen || {};
      return {
        vida: { max: classResources.vida ?? this.classCfg.stats.hp, regen: regen.vida || 0 },
        mana: { max: classResources.mana || 0, regen: regen.mana || 0 },
        stamina: { max: classResources.stamina || 0, regen: regen.stamina === undefined ? PARAMS.staminaRegen : regen.stamina },
        eter: { max: classResources.eter || 0, regen: regen.eter || 0 }
      };
    }

    get hp() { return this.resources.current('vida'); }
    set hp(value) { this.resources.set('vida', value); }
    get maxHp() { return this.resources.maximum('vida'); }
    get mana() { return this.resources.current('mana'); }
    set mana(value) { this.resources.set('mana', value); }
    get maxMana() { return this.resources.maximum('mana'); }
    get stamina() { return this.resources.current('stamina'); }
    set stamina(value) { this.resources.set('stamina', value); }
    get maxStamina() { return this.resources.maximum('stamina'); }
    get eter() { return this.resources.current('eter'); }
    set eter(value) { this.resources.set('eter', value); }
    get maxEter() { return this.resources.maximum('eter'); }

    canPayResources(costs) { return this.resources.canPay(costs); }
    spendResources(costs) { return this.resources.spend(costs); }

    // ---- STATUS ----
    hasStatus(id) { return !!this.statuses[id]; }
    applyStatus(id, dur) {
      if (!STATUS[id]) return;
      const cur = this.statuses[id];
      const newT = dur || STATUS[id].dur;
      if (!cur || cur.t < newT) this.statuses[id] = { t: newT };
    }
    updateStatuses(dt) {
      let dot = 0;
      let dmgTakenMul = 1, dmgDealtMul = 1, speedMul = 1;
      let heal = 0;
      let stunPending = false;

      for (const id in this.statuses) {
        const S = STATUS[id];
        const st = this.statuses[id];
        st.t -= dt;

        if (S.dot) dot += S.dot;
        if (S.dmgTakenMul) dmgTakenMul *= S.dmgTakenMul;
        if (S.dmgDealtMul) dmgDealtMul *= S.dmgDealtMul;
        if (S.slow) speedMul *= S.slow;
        if (S.heal) heal += S.heal;

        // Electrified - stun periódico
        if (S.stunEach) {
          if (!st.nextTick) st.nextTick = S.stunEach;
          st.nextTick -= dt;
          if (st.nextTick <= 0) {
            st.nextTick = S.stunEach;
            stunPending = true;
          }
        }

        // Visual particles
        if (Math.random() < 0.4) {
          const a = Math.random() * 6.2832;
          const r = 30;
          spawnParticle(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r,
            Math.cos(a) * 40, Math.sin(a) * 40,
            S.hue, 2 + Math.random() * 2, 1.5, 70);
        }

        if (st.t <= 0) delete this.statuses[id];
      }

      this._dotDamage = dot;
      this._dmgTakenMul = dmgTakenMul;
      this._dmgDealtMul = dmgDealtMul;
      this._speedMul = speedMul;
      if (heal) this.hp = Math.min(this.maxHp, this.hp + heal * dt);
      if (stunPending && !this.isImmune()) {
        this.stunTime = Math.max(this.stunTime, STATUS.electrified.stunDur);
        this.state = 'hurt'; this.timer = 0;
      }
    }
    get speedMul() {
      const awakening = this.classCfg.getSpeedMultiplier?.(this) ?? 1;
      const penalty = this.speedPenaltyT > 0 ? 0.55 : 1;
      return (this._speedMul || 1) * awakening * penalty;
    }
    get dmgTakenMul() { return this._dmgTakenMul || 1; }
    get dmgDealtMul() { return this._dmgDealtMul || 1; }

    isImmune() {
      return isDebugInvulnerable(this) || this.dodgeIframesT > 0 || this.parryImmuneT > 0 || this.immuneT > 0;
    }
    isBlocking(incomingAngle) { return this.classCfg.isBlocking?.(this, incomingAngle) ?? this.blocking; }
    isParrying() { return this.parryWindow > 0; }
    tryAbsorbArcane(damage) { return this.classCfg.onAbsorb?.(this, damage) ?? false; }

    tryDeflectProjectile(projectile) { return this.classCfg.onDeflect?.(this, projectile) ?? false; }

    // ============ APPLY INTENT ============
    applyIntent(dt, intent, opp) {
      this.heldActions = intent.heldActions || new Set();
      this.holdTimes = intent.holdTimes || {};
      for (const [key, actions] of Object.entries(ABILITY_ACTIONS)) {
        if (this.abilities[key]) for (const action of actions) intent.actions.delete(action);
      }
      if (intent.aimAngle !== undefined) this.aimAngle = intent.aimAngle;

      const inFree = (this.state === 'idle' || this.state === 'recover' || this.state === 'charge' || this.state === 'meditate');
      if (this.state === 'idle' || this.state === 'recover') {
        for (const action of intent.releasedActions || []) {
          const slot = action === 'ataque_basico' ? 'lmb' : 'rmb';
          const ability = slot === 'lmb' ? 'basic' : 'secondary';
          if (!this.abilities[ability]) {
            this.classCfg.onBasicRelease?.(this, slot, opp, intent.releaseTimes && intent.releaseTimes[action] || 0, intent);
          }
        }
      }

      // Movimento
      if (inFree) {
        const mx = intent.moveX, my = intent.moveY;
        if (!this.isPlayer && Number.isFinite(intent.moveVx) && Number.isFinite(intent.moveVy)) {
          this.vx = intent.moveVx * this.speedMul;
          this.vy = intent.moveVy * this.speedMul;
        } else {
          const m = Math.hypot(mx, my);
          if (m > 0) {
          const mul = this.speedMul;
          this.vx = (mx / m) * this.maxSpeed * mul;
          this.vy = (my / m) * this.maxSpeed * mul;
          } else { this.vx *= 0.85; this.vy *= 0.85; }
        }
      }

      // Escudo
      if (intent.actions.has('escudo') && inFree && (this.classCfg.canStartBlock?.(this) ?? true)) this.blocking = true;
      else this.blocking = false;

      // Carregar
      if (intent.actions.has('charge') && inFree) {
        this.state = 'charge';
        this.resources.restore('stamina', PARAMS.staminaRegen * 4 * dt);
        if (Math.random() < 0.4) {
          const a = Math.random() * 6.2832, r = 70;
          spawnParticle(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r, -Math.cos(a) * 100, -Math.sin(a) * 100, 200, 2, 1.5, 85);
        }
        return;
      } else if (this.state === 'charge') {
        this.state = 'recover'; this.timer = 0;
      }

      // Meditar
      if (intent.actions.has('meditar') && inFree) {
        this.state = 'meditate';
        return;
      } else if (this.state === 'meditate') {
        this.state = 'recover'; this.timer = 0;
      }

      if (!inFree) return;

      // Ações instantâneas
      if (intent.actions.has('ataque_basico') && this.cd.ataque_basico <= 0) {
        this.doBasicAttack(opp, this.aimAngle, 'lmb');
        if (!this.classCfg.immediateBasics) return;
      }
      if (intent.actions.has('ataque_secundario') && this.cd.ataque_secundario <= 0) {
        this.doBasicAttack(opp, this.aimAngle, 'rmb');
        if (!this.classCfg.immediateBasics) return;
      }
      if (intent.actions.has('dash') && this.classCfg.canDash !== false && this.cd.dash <= 0 && this.canPayResources(HABILIDADES.dash.custo)) {
        this.doDash(intent.moveX, intent.moveY); return;
      }
      if (intent.actions.has('super_dash') && this.cd.super_dash <= 0 && this.canPayResources(HABILIDADES.super_dash.custo)) {
        this.doSuperDash(this.aimAngle); return;
      }
      if (intent.actions.has('parry') && this.classCfg.canParry !== false && this.cd.parry <= 0) {
        this.state = 'parry';
        this.parryWindow = 0.22;
        this.cd.parry = HABILIDADES.parry.cd;
        this.timer = 0;
        return;
      }
      if (intent.actions.has('skill_z') && this.cd.skill_z <= 0) {
        this.useSkill('z', opp, intent); return;
      }
      if (intent.actions.has('skill_x') && this.cd.skill_x <= 0) {
        this.useSkill('x', opp, intent); return;
      }
      if (intent.actions.has('skill_c') && this.cd.skill_c <= 0) {
        this.useSkill('c', opp, intent); return;
      }
      if (intent.actions.has('skill_v') && this.cd.skill_v <= 0) {
        this.useSkill('v', opp, intent); return;
      }
      if (intent.actions.has('transform_t') && this.cd.transform_t <= 0 &&
          (this.classCfg.activateMove || this.canPayResources(HABILIDADES.transform_t.custo))) {
        if (this.classCfg.activateMove) this.classCfg.activateMove(this, 't', opp, intent);
        else this.awaken(opp);
        return;
      }
      if (intent.actions.has('transform_g') && this.cd.transform_g <= 0 &&
          (this.classCfg.activateMove || this.canPayResources(HABILIDADES.transform_g.custo))) {
        if (this.classCfg.activateMove) this.classCfg.activateMove(this, 'g', opp, intent);
        else this.grabAwakening(opp);
        return;
      }
      if (intent.actions.has('transform_b') && this.cd.transform_b <= 0 &&
          (this.classCfg.activateMove || this.canPayResources(HABILIDADES.transform_b.custo))) {
        if (this.classCfg.activateMove) this.classCfg.activateMove(this, 'b', opp, intent);
        else this.burstAwakening(opp);
        return;
      }
      if (intent.actions.has('ult1') && this.cd.ult1 <= 0 &&
          (this.classCfg.activateMove || this.canPayResources(HABILIDADES.ult1.custo))) {
        if (this.classCfg.activateMove) this.classCfg.activateMove(this, 'y', opp, intent);
        else this.startUltimate('y', opp);
        return;
      }
      if (intent.actions.has('ult2') && this.cd.ult2 <= 0 &&
          (this.classCfg.activateMove || this.canPayResources(HABILIDADES.ult2.custo))) {
        if (this.classCfg.activateMove) this.classCfg.activateMove(this, 'h', opp, intent);
        else this.startUltimate('h', opp);
        return;
      }
      if (intent.actions.has('especial_z') && this.cd.especial_z <= 0 && this.canPayResources(HABILIDADES.especial_z.custo)) {
        this.doEspecialZ(opp, this.aimAngle); return;
      }
      if (intent.actions.has('especial_c') && this.cd.especial_c <= 0 && this.canPayResources(HABILIDADES.especial_c.custo)) {
        this.doEspecialC(opp); return;
      }
      if (intent.actions.has('especial_v') && this.cd.especial_v <= 0 && this.canPayResources(HABILIDADES.especial_v.custo)) {
        this.doEspecialV(opp, this.aimAngle); return;
      }
      if (intent.actions.has('especial_e') && this.cd.especial_e <= 0 && this.canPayResources(HABILIDADES.especial_e.custo)) {
        this.useSpecialE(opp); return;
      }
    }

    // ============ ATAQUE BÁSICO (por classe) ============
    };
  }
};

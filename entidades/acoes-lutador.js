window.createBattleFighterActions = function (scope) {
  with (scope) {
    return class FighterActions {
      doBasicAttack(opp, angle, slot) { this.classCfg.moveset[slot]?.(this, opp); }

      performBasicAttack(opp, angle, slot, cfg, visual) {
        const key = slot === 'lmb' ? 'ataque_basico' : 'ataque_secundario';
        if (cfg.type === 'slash' || cfg.type === 'strike') {
          if (cfg.cost && !this.canPayResources(cfg.cost)) return;
          if (cfg.cost) this.spendResources(cfg.cost);
          this.cd[key] = cfg.cooldown === undefined ? HABILIDADES[key].cd : cfg.cooldown;
          if (cfg.type === 'slash' && cfg.swept) {
            const duration = cfg.dur || 0.1;
            const direction = cfg.swing === 'horario' ? 1 : -1;
            const startAngle = angle - direction * (cfg.arc || Math.PI * 2 / 3) * 0.5;
            const endAngle = angle + direction * (cfg.arc || Math.PI * 2 / 3) * 0.5;
            const swing = Registro.obterEfeito('corte').criar({
              tipo: 'arco', owner: this, x: this.x, y: this.y, angle, length: cfg.range, hue: cfg.hue || 320,
              life: 1, decay: 1, thickness: cfg.thickness || 18, arc: cfg.arc, autoSweep: false, fade: 0.1,
              swingInicio: startAngle, swingFim: endAngle,
              swing: cfg.swing, progress: 0, duracao: duration
            });
            this.basicAttack = {
              elapsed: 0, windup: cfg.windup || 0.04, duration,
              recovery: cfg.recovery || 0.1, angle, swing, target: opp,
              range: cfg.range, arc: cfg.arc || Math.PI * 2 / 3,
              damage: cfg.damage, stun: cfg.stun, status: cfg.status,
              knockback: cfg.knockbackForce || 220, hit: false
            };
            this.state = 'basicAttack';
            this.timer = 0;
            return;
          }
          if (cfg.type === 'strike' && cfg.squares) {
            Registro.obterEfeito('corte').criar({
              tipo: 'quadrado', owner: this, target: opp, x: this.x, y: this.y,
              angle, hue: cfg.hue || this.hue, windup: cfg.windup || 0.04, damage: cfg.damage,
              stun: cfg.stun, knockback: cfg.knockbackForce || 700
            });
            this.state = 'recover';
            this.timer = 0;
            this.recoveryDuration = cfg.recovery || 0.1;
            return;
          }
          if (cfg.instant) {
            Registro.obterEfeito('corte').criar({
              x: this.x, y: this.y, angle, length: cfg.range * 2,
              hue: this.hue, life: 1, decay: 5, thickness: cfg.thickness || 18,
              swing: cfg.swing
            });
            const dx = opp.x - this.x, dy = opp.y - this.y;
            const distance = Math.hypot(dx, dy);
            let relative = Math.atan2(dy, dx) - angle;
            while (relative > Math.PI) relative -= Math.PI * 2;
            while (relative < -Math.PI) relative += Math.PI * 2;
            if (distance <= cfg.range + (opp.bodyRadius || 40) && Math.abs(relative) <= (cfg.halfAngle || Math.PI * 0.5)) {
              this.applyHit(opp, cfg.damage, angle, cfg.knockbackForce || 220, cfg.stun, cfg.status || null);
            }
            this.classCfg.onBasicAttack?.(this, opp, angle, slot, cfg);
            return;
          }
          this.state = 'strike'; this.strikeStart = { x: this.x, y: this.y };
          this.strikeT = 0; this.strikeDur = cfg.dur; this.strikeWindup = cfg.windup;
          this.strikeAngle = angle; this.strikeRange = cfg.range; this.strikeDamage = cfg.damage;
          this.strikeStun = cfg.stun; this.strikeStatus = cfg.status || null; this.strikeApplyOnce = false;
          if (cfg.impulse) { this.vx += Math.cos(angle) * this.maxSpeed * cfg.impulseForce; this.vy += Math.sin(angle) * this.maxSpeed * cfg.impulseForce; }
          if (cfg.knockback) this._knockbackStrike = cfg.knockbackForce;
          if (cfg.impulseBack) { this.vx -= Math.cos(angle) * this.maxSpeed * cfg.impulseBack; this.vy -= Math.sin(angle) * this.maxSpeed * cfg.impulseBack; }
          if (visual === 'sword') {
            Registro.obterEfeito('corte').criar({ x: this.x, y: this.y, angle, length: cfg.range * (slot === 'rmb' ? 1.3 : 1.8), hue: this.hue, life: 1, decay: 4.5, thickness: slot === 'rmb' ? 14 : 22 });
          } else {
            Registro.obterEfeito('corte').criar({ x: this.x + Math.cos(angle) * 60, y: this.y + Math.sin(angle) * 60, angle, length: 130, hue: this.hue, life: 1, decay: 5, thickness: 8 });
          }
        } else if (cfg.type === 'projectile') {
          const cost = cfg.cost || {};
          if (!this.canPayResources(cost)) return;
          this.cd[key] = cfg.cooldown === undefined ? HABILIDADES[key].cd : cfg.cooldown;
          this.spendResources(cost);
          const charged = cfg.chargeMax
            ? Math.min(1, (this.holdTimes.ataque_secundario || 0) / cfg.chargeDuration)
            : 0;
          Projectiles.spawn({
            owner: this, x: this.x, y: this.y, vx: Math.cos(angle) * cfg.speed,
            vy: Math.sin(angle) * cfg.speed, type: cfg.projType,
            damage: cfg.damage + (cfg.chargeMax || 0) * charged,
            radius: cfg.radius, stun: cfg.stun, homing: cfg.homing || 0,
            unblockable: !!(cfg.chargeMax && charged >= 1),
            piercing: !!(cfg.piercing && charged >= 1),
            status: cfg.status
          });
          this.classCfg.onBasicAttack?.(this, opp, angle, slot, cfg);
          this.state = 'recover'; this.timer = 0;
        }
      }

      doDash(mx, my) {
        const m = Math.hypot(mx, my);
        let dx, dy;
        if (m > 0) { dx = mx / m; dy = my / m; }
        else { dx = this.side < 0 ? 1 : -1; dy = 0; }
        this.state = 'dodge'; this.dodgeT = PARAMS.dodgeDur; this.dodgeIframesT = PARAMS.dodgeIframes;
        this.vx = dx * this.maxSpeed * 1.8; this.vy = dy * this.maxSpeed * 1.8;
        this.spendResources(HABILIDADES.dash.custo); this.cd.dash = HABILIDADES.dash.cd; this.timer = 0;
      }

      doSuperDash(angle) {
        this.state = 'superdash'; this.timer = 0; this.superDashAngle = angle; this.superDashT = 0;
        this.vx = Math.cos(angle) * this.maxSpeed * 3; this.vy = Math.sin(angle) * this.maxSpeed * 3;
        this.spendResources(HABILIDADES.super_dash.custo); this.cd.super_dash = HABILIDADES.super_dash.cd;
        this.immuneT = Math.max(this.immuneT, 0.35); addExplosion(this.x, this.y, this.hue, 1.5, false);
      }

      doEspecialZ(opp, angle, costPaid = false) {
        if (!costPaid) { this.spendResources(HABILIDADES.especial_z.custo); this.cd.especial_z = HABILIDADES.especial_z.cd; }
        this.classCfg.moveset.z?.(this, opp);
      }

      doEspecialC(opp, costPaid = false) {
        if (!costPaid) { this.spendResources(HABILIDADES.especial_c.custo); this.cd.especial_c = HABILIDADES.especial_c.cd; }
        this.classCfg.moveset.c?.(this, opp);
      }

      doEspecialV(opp, angle, costPaid = false) {
        if (!costPaid) { this.spendResources(HABILIDADES.especial_v.custo); this.cd.especial_v = HABILIDADES.especial_v.cd; }
        this.classCfg.moveset.v?.(this, opp);
      }

      useSkill(slot, opp, intent) {
        if (this.classCfg.activateMove) {
          this.classCfg.activateMove(this, slot, opp, intent);
          return;
        }
        const key = `skill_${slot}`, cfg = HABILIDADES[key];
        const forced = slot === 'x' && debug.bypassSkillX === this;
        if (forced) debug.bypassSkillX = null;
        if (!forced && !this.canPayResources(cfg.custo)) return;
        if (forced) this.cd[key] = 0;
        else { this.spendResources(cfg.custo); this.cd[key] = cfg.cd; }
        this.classCfg.moveset[slot]?.(this, opp);
      }

      useSpecialE(opp) {
        const cfg = HABILIDADES.especial_e;
        this.spendResources(cfg.custo); this.cd.especial_e = cfg.cd;
        this.classCfg.moveset.e?.(this, opp);
      }

      awaken(opp) { this.classCfg.moveset.t?.(this, opp); }
      grabAwakening(opp) { return this.classCfg.moveset.g?.(this, opp) ?? false; }
      burstAwakening(opp) { this.classCfg.moveset.b?.(this, opp); }
      startUltimate(slot, opp) { this.performUltimateStart(slot, opp); }

      performAwakening() {
        this.spendResources(HABILIDADES.transform_t.custo); this.cd.transform_t = HABILIDADES.transform_t.cd;
        this.awakeningT = 12; this._awakenedDefense = 1;
        const result = this.classCfg.onAwaken?.(this) || {};
        if (result.defense !== undefined) this._awakenedDefense = result.defense;
        if (result.manaRestore) this.resources.restore('mana', result.manaRestore);
        addExplosion(this.x, this.y, this.hue, 2.2, true); startCinematic(this, 1.7);
      }

      performGrabAwakening(opp) {
        if (Math.hypot(opp.x - this.x, opp.y - this.y) > 190) return false;
        this.spendResources(HABILIDADES.transform_g.custo); this.cd.transform_g = HABILIDADES.transform_g.cd;
        const oldX = this.x, oldY = this.y;
        opp.x = opp.x < WORLD.w / 2 ? WORLD.w * 0.86 : WORLD.w * 0.14;
        opp.y = Math.max(100, Math.min(WORLD.h - 100, opp.y + (Math.random() - 0.5) * 260));
        this.stunTime = 0.85; this.state = 'hurt'; this.timer = 0; this.speedPenaltyT = 5;
        opp.stunTime = 2.4; opp.state = 'hurt'; opp.timer = 0;
        addExplosion(oldX, oldY, this.hue, 2, true); addExplosion(opp.x, opp.y, this.hue, 3.2, true);
        startCinematic(this, 2.5); return true;
      }

      performBurstAwakening(opp) {
        this.spendResources(HABILIDADES.transform_b.custo); this.cd.transform_b = HABILIDADES.transform_b.cd;
        const radius = 300;
        for (let i = Projectiles.list.length - 1; i >= 0; i--) {
          const p = Projectiles.list[i];
          if (!p.special && Math.hypot(p.x - this.x, p.y - this.y) < radius) {
            addExplosion(p.x, p.y, this.hue, 0.55, false); Projectiles.list.splice(i, 1);
          }
        }
        if (Math.hypot(opp.x - this.x, opp.y - this.y) < radius) this.applyHit(opp, 30, Math.atan2(opp.y - this.y, opp.x - this.x), 900, 0.65, null, true);
        addExplosion(this.x, this.y, this.hue, 3, true);
        Registro.obterEfeito('explosao').criar({ x: this.x, y: this.y, hue: this.hue, explosao: false, onda: { maxR: radius * 1.5, speed: 1400 }, shake: false });
        startCinematic(this, 1.8);
      }

      performUltimateStart(slot, opp) {
        const key = slot === 'y' ? 'ult1' : 'ult2';
        if (!this.canPayResources(HABILIDADES[key].custo) || this.ultimate || this.specialActive) return;
        this.spendResources(HABILIDADES[key].custo); this.cd[key] = HABILIDADES[key].cd;
        this.ultimate = { slot, elapsed: 0, phase: 'charge', angle: Math.atan2(opp.y - this.y, opp.x - this.x), hit: false, tick: 0, count: 0, originX: this.x, originY: this.y };
        this.immuneT = slot === 'y' ? 2.6 : 4; this.state = 'ultimate';
        startCinematic(this, slot === 'y' ? 4.5 : 8); addExplosion(this.x, this.y, this.hue, 3, true);
        this.classCfg.moveset[slot]?.(this, opp, 'start');
      }

      updateSkill(dt, opp) { this.classCfg.updateSkill?.(this, dt, opp); }
      updateUltimate(dt, opp) {
        if (this.ultimate) this.classCfg.moveset[this.ultimate.slot]?.(this, opp, 'update', dt);
      }
      updateSpecial(dt, opp) { this.classCfg.updateSpecial?.(this, dt, opp); }

      finishUltimate() {
        this.ultimate = null; this.state = 'recover'; this.timer = 0;
        if (state.timeStop.owner === this) state.timeStop = { owner: null, timer: 0, duration: 0 };
        endCinematic(this);
      }
    };
  }
};

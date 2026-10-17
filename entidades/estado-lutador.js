window.createBattleFighterState = function (scope) {
  with (scope) {
    return class FighterState {
    applyHit(target, rawDamage, angle, knockback, stunTime, statusId, big = false, unblockable = false, ignoreImmunity = false, ignoreBarrier = false) {
      if (target.hp <= 0) return;
      if (!ignoreImmunity && target.isImmune()) return;
      if (target.isParrying()) { this.onParried(target); return; }

      // Multiplicadores
      let dmg = rawDamage * this.dmgDealtMul * (this.damageMultiplier || 1) * (this.nextHitMultiplier || 1);
      if (target.markedBy === this && target.markTime > 0) dmg *= 1.3;
      if (target.vulnerabilityOwner === this && target.vulnerabilityTime > 0) dmg *= target.vulnerabilityMultiplier || 1.1;
      if (!unblockable) dmg *= (1 - target.resistance);
      dmg *= (target.dmgTakenMul || target._dmgTakenMul || 1) * (target._awakenedDefense || 1);
      if (!unblockable && !ignoreBarrier && target.tryAbsorbArcane(dmg)) return;
      const blocking = target.isBlocking(angle);
      if (blocking && !target.classCfg.onAbsorb) dmg *= 0.1;

      target.hp = Math.max(0, target.hp - dmg);
      this.classCfg.onHit?.(this, target, dmg);
      if (dmg > 0 && target.state === 'meditate') {
        target.state = 'hurt'; target.timer = 0;
      }
      target.knockbackVx += Math.cos(angle) * knockback;
      target.knockbackVy += Math.sin(angle) * knockback;

      if (stunTime > 0 && !blocking && target.state !== 'dodge') {
        const physicalHit = this.classCfg.isPhysical;
        target.stunTime = Math.max(target.stunTime, physicalHit ? Math.max(0.08, stunTime) : stunTime);
        if (target.state !== 'strike' && target.state !== 'combo24') {
          target.state = 'hurt'; target.timer = 0;
        }
      }

      // Status
      if (statusId && !blocking) {
        const status = typeof statusId === 'string' ? { id: statusId } : statusId;
        target.applyStatus(status.id, status.dur || STATUS[status.id].dur);
      }
      if (this.classCfg.isPhysical &&
          stunTime <= 0 && !target.isBlocking()) {
        target.applyStatus('slowed', 1.5);
      }

      BattleFX.addShake(big ? 70 : 20);

      if (!blocking) addExplosion(target.x, target.y, this.hue, big ? 1.5 : 0.7, false);
      state.combo++; state.comboTimeout = 1.2; updateCombo();
    }

    onParried(parrier) {
      const kx = this.x - parrier.x, ky = this.y - parrier.y;
      const kd = Math.hypot(kx, ky) || 1;
      this.knockbackVx = (kx / kd) * 2200;
      this.knockbackVy = (ky / kd) * 2200;
      this.stunTime = 1.0;
      this.state = 'hurt'; this.timer = 0;
      parrier.parryImmuneT = 0.5;
      addExplosion(parrier.x, parrier.y, 60, 2.5, true);
      addExplosion(this.x, this.y, 280, 2, true);
      flash(); BattleFX.addShake(80); BattleFX.triggerSlowMo(0.18, 0.45);
      if (!isDebugInvulnerable(this)) this.hp = Math.max(0, this.hp - 12);
      state.combo += 2; state.comboTimeout = 1.5; updateCombo();
    }

    // ============ UPDATE ============
    update(dt, opp) {
      this.timer += dt;
      for (const k in this.cd) if (this.cd[k] > 0) this.cd[k] -= dt;
      if (this.awakeningT > 0) this.awakeningT = Math.max(0, this.awakeningT - dt);
      if (this.awakeningT <= 0 && !this.kaiokenT) {
        this._awakenedDefense = 1;
        this.damageMultiplier = 1;
      }
      if (this.speedPenaltyT > 0) this.speedPenaltyT = Math.max(0, this.speedPenaltyT - dt);
      if (this.vulnerabilityTime > 0) this.vulnerabilityTime = Math.max(0, this.vulnerabilityTime - dt);
      // Status
      this.updateStatuses(dt);
      if (this._dotDamage > 0) this.hp = Math.max(0, this.hp - this._dotDamage * dt);
      if (isDebugInvulnerable(this)) this.hp = this.maxHp;

      if (this.stunTime > 0) {
        this.stunTime -= dt;
        if (this.stunTime <= 0) { this.state = 'recover'; this.timer = 0; }
      }

      this.classCfg.updatePassive?.(this, dt, opp);
      if (this._fearTime > 0) {
        this._fearTime = Math.max(0, this._fearTime - dt);
        this._dmgDealtMul = Math.min(this._dmgDealtMul || 1, this._fearMultiplier || 0.7);
      }
      if (this.dodgeT > 0) this.dodgeT -= dt;
      if (this.dodgeIframesT > 0) this.dodgeIframesT -= dt;
      if (this.parryWindow > 0) this.parryWindow -= dt;
      if (this.parryImmuneT > 0) this.parryImmuneT -= dt;
      if (this.immuneT > 0) this.immuneT -= dt;
      if (this.arcaneBarrierCooldown > 0) this.arcaneBarrierCooldown = Math.max(0, this.arcaneBarrierCooldown - dt);

      const meditation = this.state === 'meditate'
        ? (this.classCfg.meditation || { vida: PARAMS.meditHP, stamina: PARAMS.meditStamina, mana: PARAMS.meditMana, eter: 0 })
        : {};
      this.resources.regenerate(dt, {
        awakening: this.awakeningT > 0 ? 2 : 1,
        meditation
      });
      this.rage = 1 - this.hp / this.maxHp;

      // Knockback
      if (Math.abs(this.knockbackVx) > 0.5 || Math.abs(this.knockbackVy) > 0.5) {
        this.x += this.knockbackVx * dt; this.y += this.knockbackVy * dt;
        this.knockbackVx *= Math.pow(0.02, dt); this.knockbackVy *= Math.pow(0.02, dt);
      }

      if (this.stunTime > 0) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.vx *= 0.85; this.vy *= 0.85;
        this.clamp(); this.updateAfterimages(dt); return;
      }

      if (this.specialActive) {
        this.specialT += dt;
        this.updateSpecial(dt, opp);
        this.updateAfterimages(dt); this.clamp(); return;
      }
      if (this.skillActive) {
        this.updateSkill(dt, opp);
        this.clamp(); this.updateAfterimages(dt); return;
      }
      if (this.ultimate) {
        this.updateUltimate(dt, opp);
        this.clamp(); this.updateAfterimages(dt); return;
      }

      switch (this.state) {
        case 'idle': break;
        case 'recover':
          this.vx *= 0.9; this.vy *= 0.9;
          if (this.timer > (this.recoveryDuration || 0.05)) { this.state = 'idle'; this.timer = 0; this.recoveryDuration = 0.05; }
          break;
        case 'basicAttack': {
          const attack = this.basicAttack;
          if (!attack) { this.state = 'recover'; this.timer = 0; break; }
          attack.elapsed += dt;
          if (attack.elapsed >= attack.windup) {
            const progress = Math.min(1, (attack.elapsed - attack.windup) / attack.duration);
            attack.swing.progresso = progress;
            attack.swing.progress = progress;
            const arcProgress = attack.swing.swingInicio + (attack.swing.swingFim - attack.swing.swingInicio) * progress;
            const targetRadius = attack.target.bodyRadius || 40;
            const distance = Math.hypot(attack.target.x - this.x, attack.target.y - this.y);
            const slice = attack.arc * dt / attack.duration +
              Math.asin(Math.min(1, targetRadius / Math.max(distance, targetRadius)));
            reflectProjectiles(this, attack.range, arcProgress, slice);
            const dx = attack.target.x - this.x, dy = attack.target.y - this.y;
            let relative = Math.atan2(dy, dx) - arcProgress;
            while (relative > Math.PI) relative -= Math.PI * 2;
            while (relative < -Math.PI) relative += Math.PI * 2;
            if (!attack.hit && distance <= attack.range + targetRadius && Math.abs(relative) <= slice) {
              this.applyHit(attack.target, attack.damage, arcProgress, attack.knockback, attack.stun, attack.status);
              attack.hit = true;
            }
            if (progress >= 1) {
              this.basicAttack = null;
              this.state = 'recover';
              this.timer = 0;
              this.recoveryDuration = attack.recovery;
            }
          }
          break;
        }
        case 'hurt':
          this.vx *= 0.88; this.vy *= 0.88;
          if (this.timer > 0.06) { this.state = 'recover'; this.timer = 0; }
          break;
        case 'dodge':
          this.vx *= Math.pow(0.01, dt); this.vy *= Math.pow(0.01, dt);
          if (this.timer > 0.20) { this.state = 'recover'; this.timer = 0; }
          break;
        case 'parry':
          this.vx *= 0.7; this.vy *= 0.7;
          if (this.timer > 0.22) { this.state = 'recover'; this.timer = 0; }
          break;
        case 'strike': {
          this.strikeT += dt;
          if (this.strikeT < this.strikeWindup) {
            this.vx *= 0.9; this.vy *= 0.9; break;
          }
          const t = Math.min(1, (this.strikeT - this.strikeWindup) / this.strikeDur);
          const easeT = 1 - Math.pow(1 - t, 4);
          const sx = this.strikeStart.x, sy = this.strikeStart.y;
          const ex = sx + Math.cos(this.strikeAngle) * this.strikeRange;
          const ey = sy + Math.sin(this.strikeAngle) * this.strikeRange;
          this.x = sx + (ex - sx) * easeT;
          this.y = sy + (ey - sy) * easeT;
          const d = Math.hypot(opp.x - this.x, opp.y - this.y);
          const collisionRange = this.bodyRadius + (opp.bodyRadius || 40);
          if ((d < collisionRange || t >= 1) && !this.strikeApplyOnce) {
            if (d < collisionRange) {
              const kd = this._knockbackStrike || 380;
              this.applyHit(opp, this.strikeDamage, this.strikeAngle, kd, this.strikeStun, this.strikeStatus);
            }
            this.strikeApplyOnce = true;
            this._knockbackStrike = 0;
            this.state = 'recover'; this.timer = 0;
          }
          break;
        }
        case 'superdash': {
          this.superDashT += dt;
          // Destrói projéteis
          for (let i = Projectiles.list.length - 1; i >= 0; i--) {
            const p = Projectiles.list[i];
            if (p.owner === this) continue;
            if (Math.hypot(p.x - this.x, p.y - this.y) < 70) {
              addExplosion(p.x, p.y, this.hue, 0.6, false);
              Projectiles.list.splice(i, 1);
            }
          }
          const nextX = this.x + this.vx * dt, nextY = this.y + this.vy * dt;
          const stepX = nextX - this.x, stepY = nextY - this.y;
          const stepLen2 = stepX * stepX + stepY * stepY || 1;
          const projection = Math.max(0, Math.min(1, ((opp.x - this.x) * stepX + (opp.y - this.y) * stepY) / stepLen2));
          const d = Math.hypot(opp.x - (this.x + stepX * projection), opp.y - (this.y + stepY * projection));
          if (d < this.bodyRadius + (opp.bodyRadius || 40)) {
            this.applyHit(opp, this.superDashDamage || 20, this.superDashAngle, 900, 0.5, null, true);
            this.state = 'recover'; this.timer = 0;
          }
          if (this.superDashT > 0.4) { this.state = 'recover'; this.timer = 0; }
          break;
        }
        case 'combo24': {
          this.classCfg.updateMoveState?.(this, dt, opp, 'combo24');
          break;
        }
        case 'vline': {
          this.classCfg.updateMoveState?.(this, dt, opp, 'vline');
          break;
        }
      }

      // Aplica movimento para estados normais
      if (this.state !== 'strike' && this.state !== 'superdash' && this.state !== 'vline' && this.state !== 'combo24') {
        this.x += this.vx * dt; this.y += this.vy * dt;
      }
      if (this.state === 'superdash' || this.state === 'vline') {
        this.x += this.vx * dt; this.y += this.vy * dt;
      }

      this.clamp();
      this.updateAfterimages(dt);
    }

    clamp() {
      const margin = Math.max(40, this.bodyRadius || 40);
      this.x = Math.max(margin, Math.min(WORLD.w - margin, this.x));
      this.y = Math.max(margin, Math.min(WORLD.h - margin, this.y));
    }

    updateAfterimages(dt) {
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > 80 || this.specialActive || this.skillActive || this.ultimate) {
        this.afterimages.push({ x: this.x, y: this.y, life: 1 });
        if (this.afterimages.length > 20) this.afterimages.shift();
      }
      for (let i = this.afterimages.length - 1; i >= 0; i--) {
        this.afterimages[i].life -= 4.5 * dt;
        if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
      }
    }

    draw() {
      ctx.save();
      this.classCfg.draw?.(this, ctx, 'before');
      ctx.translate(this.x, this.y);
      ctx.scale(this.sizeMul || 1, this.sizeMul || 1);
      ctx.translate(-this.x, -this.y);
      if (config.efeitos.trail) for (const a of this.afterimages) {
        ctx.beginPath(); ctx.arc(a.x, a.y, 34 * Math.min(1, a.life), 0, 6.2832);
        ctx.fillStyle = `hsla(${this.hue},100%,65%,${a.life * 0.65})`; ctx.fill();
      }

      const breath = 1 + Math.sin(state.time * 5 + this.side) * 0.1;
      const r = (50 * this.aura + this.rage * 30) * breath;
      const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
      g.addColorStop(0, `hsla(${this.hue},100%,95%,0.98)`);
      g.addColorStop(0.25, `hsla(${this.hue},100%,70%,0.75)`);
      g.addColorStop(0.6, `hsla(${this.hue},100%,55%,0.3)`);
      g.addColorStop(1, `hsla(${this.hue},100%,50%,0)`);
      ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, 6.2832); ctx.fillStyle = g; ctx.fill();

      this.classCfg.draw?.(this, ctx, 'body');

      ctx.beginPath(); ctx.arc(this.x, this.y, 7, 0, 6.2832);
      ctx.fillStyle = `hsla(${this.hue},100%,100%,0.95)`; ctx.fill();

      if (this.isPlayer) {
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 1.75, 0, 6.2832);
        ctx.strokeStyle = `rgba(80,255,180,${0.5 + Math.sin(state.time * 8) * 0.3})`;
        ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
      }
      if (this.awakeningT > 0) {
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 1.55, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${this.hue},100%,75%,${0.35 + Math.sin(state.time * 8) * 0.2})`;
        ctx.lineWidth = 4; ctx.stroke();
      }
      // Aura de status (anel externo)
      for (const id in this.statuses) {
        const S = STATUS[id];
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 1.35, 0, 6.2832);
        ctx.strokeStyle = `hsla(${S.hue},100%,65%,${0.5 + Math.sin(state.time * 10) * 0.3})`;
        ctx.lineWidth = 3; ctx.stroke();
      }

      if (this.isBlocking() && !this.classCfg.customBlockDraw) {
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 1.2, 0, 6.2832);
        ctx.strokeStyle = 'rgba(80,255,180,0.8)'; ctx.lineWidth = 5; ctx.stroke();
      }
      this.classCfg.draw?.(this, ctx, 'after');
      if (this.isParrying()) { ctx.beginPath(); ctx.arc(this.x, this.y, r * 1.4, 0, 6.2832); ctx.strokeStyle = 'rgba(255,220,80,0.95)'; ctx.lineWidth = 7; ctx.stroke(); }
      if (this.dodgeIframesT > 0) { ctx.beginPath(); ctx.arc(this.x, this.y, r * 1.5, 0, 6.2832); ctx.strokeStyle = 'rgba(180,180,255,0.7)'; ctx.lineWidth = 4; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([]); }
      ctx.restore();
    }

    drawAimLine() {
      if (!this.isPlayer) return;
      const len = 280;
      const ex = this.x + Math.cos(this.aimAngle) * len;
      const ey = this.y + Math.sin(this.aimAngle) * len;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ex, ey);
      ctx.strokeStyle = `hsla(${this.hue},100%,85%,0.35)`; ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }
    };
  }
};

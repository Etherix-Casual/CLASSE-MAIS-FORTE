window.createBattleSwordsman = function (scope) {
  with (scope) {
    const basic = {
      lmb: { name: 'Corte', type: 'slash', swept: true, swing: 'horario', arc: Math.PI * 140 / 180, dur: 0.1, windup: 0.04, recovery: 0.1, damage: 12, stun: 0.14, range: 210, hue: 320, status: { id: 'bleeding', dur: 6 } },
      rmb: { name: 'Corte Pesado', type: 'slash', swept: true, swing: 'anti-horario', arc: Math.PI * 140 / 180, dur: 0.12, windup: 0.04, recovery: 0.1, damage: 18, stun: 0.24, range: 185, hue: 320, thickness: 26, status: { id: 'bleeding', dur: 8 } }
    };
    const cfg = {
      name: 'ESPADACHIM', hue: 320,
      stats: { hp: 170, resistance: 0.42, maxSpeed: 1050, basicRange: 210, resources: { vida: 170, stamina: 250, mana: 0, eter: 0, regen: { stamina: 5 } } },
      isPhysical: true,
      basic,
      immediateBasics: true,
      aiArchetype: {
        style: { desiredMin: 150, desiredMax: 300, keepDistance: false },
        chooseAction(f, opp, dist, roll) {
          if (dist < 320 && f.cd.skill_c <= 0 && roll < 0.12) return 'skill_c';
          if (dist < 500 && f.cd.skill_x <= 0 && roll < 0.12) return 'skill_x';
          if (dist < 500 && f.cd.skill_v <= 0 && roll < 0.08) return 'skill_v';
          if (dist < 420 && f.cd.transform_g <= 0 && roll < 0.08) return 'transform_g';
          if (dist < 700 && f.cd.skill_z <= 0 && roll < 0.1) return 'skill_z';
          if (f.cd.ult2 <= 0 && dist < 900 && roll < 0.03) return 'ult2';
          return null;
        }
      },
      onCreate(f) {
        f.blockCooldown = 0;
        f.xCharges = 3;
        f.xChargeTimers = [];
        f.xChargeSequence = 0;
      },
      updatePassive(f, dt) {
        f.blockCooldown = Math.max(0, f.blockCooldown - dt);
        for (let i = f.xChargeTimers.length - 1; i >= 0; i--) {
          const timer = f.xChargeTimers[i];
          timer.remaining -= dt;
          if (timer.remaining <= 0) {
            f.xCharges = Math.min(3, f.xCharges + 1);
            f.xChargeTimers.splice(i, 1);
          }
        }
        f.cd.skill_x = f.xCharges > 0
          ? 0
          : (f.xChargeTimers.length ? Math.min(...f.xChargeTimers.map(timer => timer.remaining)) : 0);
      },
      getSpeedMultiplier: f => f.awakeningT > 0 ? 1.35 : 1,
      canStartBlock: () => true,
      isBlocking(f, incomingAngle) {
        if (!f.blocking) return false;
        if (incomingAngle === undefined) return true;
        let relative = incomingAngle + Math.PI - f.aimAngle;
        while (relative > Math.PI) relative -= Math.PI * 2;
        while (relative < -Math.PI) relative += Math.PI * 2;
        return Math.abs(relative) <= Math.PI / 3;
      },
      onDeflect(f, projectile) {
        if (!f.blocking || f.blockCooldown > 0 || projectile.owner === f || projectile.special || projectile.deflected) return false;
        if (Math.hypot(projectile.x - f.x, projectile.y - f.y) > 150) return false;
        let relative = Math.atan2(projectile.y - f.y, projectile.x - f.x) - f.aimAngle;
        while (relative > Math.PI) relative -= Math.PI * 2;
        while (relative < -Math.PI) relative += Math.PI * 2;
        if (Math.abs(relative) > Math.PI / 3 || !reflectProjectile(projectile, f, 1.5)) return false;
        f.blockCooldown = 0.4;
        Registro.obterEfeito('corte').criar({ x: f.x, y: f.y, angle: f.aimAngle, length: 170, hue: f.hue, life: 1, decay: 5, thickness: 20 });
        BattleFX.addShake(35);
        return true;
      },
      onAwaken: f => { f.damageMultiplier = 1.25; return { defense: 0.75 }; },
      moveset: {
        lmb: (f, opp) => f.performBasicAttack(opp, f.aimAngle, 'lmb', basic.lmb, 'sword'),
        rmb: (f, opp) => f.performBasicAttack(opp, f.aimAngle, 'rmb', basic.rmb, 'sword')
      },
      activateMove(f, slot, opp, intent) {
        const moves = {
          z: { cost: { stamina: 45 }, cooldown: 4, recovery: 0.25, data: { type: 'flying-slash' } },
          x: { cost: { stamina: 65 }, cooldown: 0, recovery: 0.2, data: { type: 'instant-cut', phase: 'windup' } },
          c: { cost: { stamina: 120 }, cooldown: 14, recovery: 0.5, data: { type: 'combo24', phase: 'windup', count: 0, tick: 0, holdAction: 'skill_c' } },
          v: { cost: { stamina: 40 }, cooldown: 16, recovery: 0.25, holdAction: 'skill_v', data: { type: 'cut-storm', tick: 0, visualTick: 0, chargeElapsed: 0, aiHoldDuration: 1 } },
          g: { cost: { stamina: 90 }, cooldown: 18, recovery: 0.45, data: { type: 'stun-lunge' } },
          b: { cost: { stamina: 60 }, cooldown: 15, recovery: 0.1, data: { type: 'reflective-aura' } },
          t: { cost: { stamina: 80 }, cooldown: 60, recovery: 0.2, data: { type: 'awakening' } },
          y: { cost: { stamina: 250 }, cooldown: 65, recovery: 1, data: { type: 'screen-cut', phase: 'lunge', travelled: 0 } },
          h: { cost: { stamina: 100 }, cooldown: 22, recovery: 0.25, data: { type: 'laser-cut' } }
        };
        const options = moves[slot];
        if (slot === 'x' && f.xCharges <= 0) return false;
        if (slot === 'g' && Math.hypot(opp.x - f.x, opp.y - f.y) > 420) {
          return false;
        }
        if (!options || !startMove(f, slot, opp, options)) return false;
        if (slot === 'x') {
          f.xCharges--;
          f.skillData.chargeToken = ++f.xChargeSequence;
          f.xChargeTimers.push({ token: f.skillData.chargeToken, remaining: 7 });
          f.cd.skill_x = f.xCharges > 0 ? 0 : 7;
        }
        if (slot === 'c') {
          const targetX = Number.isFinite(intent.mouseWorldX)
            ? intent.mouseWorldX
            : f.x + Math.cos(f.aimAngle) * 350;
          const targetY = Number.isFinite(intent.mouseWorldY)
            ? intent.mouseWorldY
            : f.y + Math.sin(f.aimAngle) * 350;
          Object.assign(f.skillData, {
            angle: f.aimAngle,
            aviso: { tipo: 'corte-24', ateX: targetX, ateY: targetY, ateTempo: 0.35 }
          });
        }
        if (slot === 't') startCinematic(f, 1.4);
        if (slot === 'y') startCinematic(f, 3);
        return true;
      },
      updateSkill(f, dt, opp) {
        const data = f.skillData;
        if (!data) { finishMove(f, 0.1); return; }
        data.elapsed += dt;
        const holdAction = ({ z: 'skill_z', x: 'skill_x', c: 'skill_c', v: 'skill_v', g: 'transform_g', b: 'transform_b', h: 'ult2', y: 'ult1' })[data.slot];
        const isHeld = data.startedHeld && f.heldActions.has(holdAction);
        const channelHeld = data.type === 'cut-storm'
          ? (f.isPlayer ? isHeld : data.elapsed < data.aiHoldDuration)
          : isHeld;
        if (isHeld) data.holdElapsed += dt;
        if (data.angle === undefined) data.angle = f.aimAngle;
        const angle = data.angle;
        const createArc = (x, y, arcAngle, radius, duration = 0.1, big = false) => Registro.obterEfeito('corte').criar({
          tipo: 'arco', x, y, angle: arcAngle, arc: Math.PI * 140 / 180,
          swing: 'horario', progress: 0, autoSweep: true, duracao: duration,
          length: radius, hue: 320, thickness: big ? 28 : 12, big, fade: 0.1
        });
        const enemyTargets = () => [
          opp,
          ...Minions.units.filter(unit => unit.owner.side !== f.side && unit.hp > 0)
        ];
        const makeArcBurst = (x, y, radius, count, big) => {
          for (let i = 0; i < count; i++) {
            const positionAngle = Math.random() * Math.PI * 2;
            const positionRadius = Math.sqrt(Math.random()) * radius;
            const swingAngle = Math.random() * Math.PI * 2;
            createArc(
              x + Math.cos(positionAngle) * positionRadius,
              y + Math.sin(positionAngle) * positionRadius,
              swingAngle,
              big ? 65 + Math.random() * 90 : 18 + Math.random() * 22,
              big ? 0.22 : 0.1,
              big
            );
          }
        };
        const distanceToSegment = (x, y, x1, y1, x2, y2) => {
          const dx = x2 - x1, dy = y2 - y1;
          const lengthSquared = dx * dx + dy * dy || 1;
          const projection = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
          return Math.hypot(x - (x1 + dx * projection), y - (y1 + dy * projection));
        };
        switch (data.type) {
          case 'flying-slash':
            if (!data.fired) {
              Projectiles.spawn({
                owner: f, x: f.x, y: f.y,
                vx: Math.cos(angle) * 2500, vy: Math.sin(angle) * 2500,
                type: 'slash', damage: 35, stun: 0.3, radius: 32, life: 1.5,
                status: { id: 'bleeding', dur: 6 }
              });
              data.fired = true;
              finishMove(f, 0.25);
            }
            break;
          case 'instant-cut': {
            if (data.elapsed < 0.1) break;
            if (data.done) break;
            data.done = true;
            const startX = f.x, startY = f.y;
            f.afterimages.push({ x: startX, y: startY, life: 1 });
            f.x += Math.cos(angle) * 150;
            f.y += Math.sin(angle) * 150;
            f.clamp();
            const hits = enemyTargets().filter(target =>
              target.hp > 0 &&
              !target.isImmune() &&
              Math.hypot(target.x - f.x, target.y - f.y) <= (target.bodyRadius || 40) + (f.bodyRadius || 40) + 22
            );
            for (const target of hits) {
              f.applyHit(target, 35, angle, 260, 0.3, { id: 'bleeding', dur: 4 });
            }
            if (hits.length) {
              createArc(f.x, f.y, angle, 150, 0.1);
              addExplosion(hits[0].x, hits[0].y, 320, 0.5, false);
              BattleFX.addShake(12);
              f.xCharges = Math.min(3, f.xCharges + 1);
              f.xChargeTimers = f.xChargeTimers.filter(timer => timer.token !== data.chargeToken);
              f.cd.skill_x = 0;
            }
            finishMove(f, 0.2);
            break;
          }
          case 'combo24':
            if (data.phase === 'windup') {
              if (data.elapsed >= 0.35 && (!data.startedHeld || !isHeld)) {
                data.phase = 'lunge';
                data.elapsed = 0;
                data.startX = f.x;
                data.startY = f.y;
              }
              break;
            }
            if (data.phase === 'lunge') {
              const previousX = f.x, previousY = f.y;
              const step = Math.min(350 - (data.travelled || 0), 1800 * dt);
              f.x += Math.cos(angle) * step;
              f.y += Math.sin(angle) * step;
              data.travelled = (data.travelled || 0) + step;
              if (opp.hp > 0 && !opp.isImmune() &&
                  distanceToSegment(opp.x, opp.y, previousX, previousY, f.x, f.y) <= (opp.bodyRadius || 40) + (f.bodyRadius || 40)) {
                f.applyHit(opp, 0, angle, 0, 1.2, null);
                data.phase = 'combo';
                data.elapsed = 0;
                data.count = 0;
                data.tick = 0;
              } else if (data.travelled >= 350) {
                finishMove(f, 0.5);
              }
              break;
            }
            if (data.phase === 'combo') {
              if (opp.hp <= 0) {
                finishMove(f, 0.5);
                break;
              }
              data.tick += dt;
              while (data.tick >= 0.09 && data.count < 24) {
                data.tick -= 0.09;
                const spinAngle = angle + data.count * 0.82;
                const spinRadius = 62;
                createArc(
                  opp.x + Math.cos(spinAngle) * spinRadius,
                  opp.y + Math.sin(spinAngle) * spinRadius,
                  spinAngle + Math.PI * 0.5,
                  125,
                  0.09
                );
                f.applyHit(opp, 12, angle, 65, 0.1, { id: 'bleeding', dur: 2 });
                data.count++;
              }
              if (data.count >= 24) {
                f.applyHit(opp, 0, angle, 0, 0.9, null);
                addExplosion(opp.x, opp.y, f.hue, 2.2, true);
                finishMove(f, 0.5);
              }
            }
            break;
          case 'cut-storm': {
            data.tick += dt;
            data.visualTick += dt;
            if (channelHeld && data.chargeElapsed < 3) {
              const charge = Math.min(dt, 3 - data.chargeElapsed, f.stamina / 20);
              if (charge > 0) {
                data.chargeElapsed += charge;
                f.resources.spend({ stamina: charge * 20 });
              }
            }
            const radius = 180 + data.chargeElapsed * 120;
            while (data.tick >= 0.15) {
              data.tick -= 0.15;
              for (const target of enemyTargets()) {
                if (target.hp > 0 && Math.hypot(target.x - f.x, target.y - f.y) <= radius + (target.bodyRadius || 0)) {
                  f.applyHit(target, 10, Math.atan2(target.y - f.y, target.x - f.x), 0, 0, { id: 'bleeding', dur: 2 });
                }
              }
            }
            while (data.visualTick >= 0.08) {
              data.visualTick -= 0.08;
              makeArcBurst(f.x, f.y, radius, 3, false);
            }
            if (!channelHeld || data.chargeElapsed >= 3 || f.stamina <= 0) {
              makeArcBurst(f.x, f.y, radius, 24, true);
              addExplosion(f.x, f.y, 320, 1.5, true);
              finishMove(f, 0.25);
            }
            break;
          }
          case 'stun-lunge': {
            f.x += Math.cos(angle) * 1200 * dt;
            f.y += Math.sin(angle) * 1200 * dt;
            if (!data.hit && Math.hypot(opp.x - f.x, opp.y - f.y) < 110) {
              f.applyHit(opp, 24, angle, 400, 1.35, null, true, false, true);
              data.hit = true;
            }
            if (data.elapsed > 0.3 || data.hit) finishMove(f);
            break;
          }
          case 'reflective-aura':
            f.reflectiveAura = true;
            reflectProjectiles(f, 300);
            data.elapsed += 0;
            if (!isHeld || data.holdElapsed >= 3 || f.stamina < 6 * dt) {
              f.reflectiveAura = false;
              finishMove(f, 0.25);
            } else f.resources.spend({ sp: 6 * dt });
            break;
          case 'awakening':
            f.awakeningT = 12;
            f._awakenedDefense = 0.75;
            f.damageMultiplier = 1.25;
            addExplosion(f.x, f.y, f.hue, 2.2, true);
            finishMove(f, 0.35);
            break;
          case 'screen-cut': {
            const previousX = f.x, previousY = f.y;
            const step = Math.min(Math.hypot(WORLD.w, WORLD.h) - data.travelled, 2500 * dt);
            f.x += Math.cos(angle) * step;
            f.y += Math.sin(angle) * step;
            data.travelled += step;
            if (!opp.isImmune() && distanceToSegment(opp.x, opp.y, previousX, previousY, f.x, f.y) <= (opp.bodyRadius || 40) + (f.bodyRadius || 40)) {
              f.applyHit(opp, 0, angle, 0, 1.5, null, true, true, true, true);
              Registro.obterEfeito('corte').criar({
                tipo: 'linha-descendo', x: f.x, y: 0, endY: WORLD.h,
                speed: WORLD.h / 0.35, life: 0.35, width: 150, hue: 45
              });
              for (const target of enemyTargets()) {
                if (target.hp > 0 && Math.abs(target.x - f.x) <= 75 + (target.bodyRadius || 0)) {
                  target.parryWindow = 0;
                  target.blocking = false;
                  f.applyHit(target, 500, Math.PI / 2, 0, 2, { id: 'bleeding', dur: 12 }, false, true, true, true);
                  target.stunTime = Math.max(target.stunTime || 0, 2);
                  target.state = 'hurt';
                  target.timer = 0;
                }
              }
              flash();
              BattleFX.addShake(100);
              BattleFX.triggerSlowMo(0.18, 0.55);
              finishMove(f, 1);
            } else if (data.travelled >= Math.hypot(WORLD.w, WORLD.h)) {
              finishMove(f, 1);
            }
            break;
          }
          case 'laser-cut':
            Registro.obterEfeito('feixe').criar({
              owner: f, x: f.x, y: f.y, angle, width: 95, length: WORLD.w,
              life: 0.3, damage: 35, tick: 0, hue: 50, singleHit: true, ignorarBarreira: true
            });
            finishMove(f, 0.45);
            break;
          default:
            finishMove(f);
        }
      },
      draw(f, ctx, phase) {
        if (phase === 'after' && f.skillData?.type === 'cut-storm') {
          const radius = 180 + (f.skillData.chargeElapsed || 0) * 120;
          ctx.beginPath();
          ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = 'hsla(320,100%,85%,0.7)';
          ctx.lineWidth = 3;
          ctx.setLineDash([12, 8]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (phase === 'after' && f.skillData?.type === 'combo24' &&
            f.skillData.phase === 'windup' && f.skillData.aviso) {
          const aviso = f.skillData.aviso;
          const pulse = 0.65 + Math.sin(state.time * 18) * 0.25;
          const dx = aviso.ateX - f.x, dy = aviso.ateY - f.y;
          const distance = Math.hypot(dx, dy);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(f.x, f.y);
          ctx.lineTo(aviso.ateX, aviso.ateY);
          ctx.strokeStyle = `hsla(320,100%,82%,${pulse * 0.7})`;
          ctx.lineWidth = 3;
          ctx.setLineDash([12, 8]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.translate(aviso.ateX, aviso.ateY);
          ctx.rotate(Math.atan2(dy, dx));
          ctx.beginPath();
          ctx.arc(0, 0, Math.min(150, Math.max(72, distance * 0.15)), -Math.PI * 0.39, Math.PI * 0.39);
          ctx.strokeStyle = `hsla(320,100%,90%,${pulse})`;
          ctx.lineWidth = 8;
          ctx.shadowColor = 'hsl(320,100%,80%)';
          ctx.shadowBlur = 20;
          ctx.stroke();
          ctx.restore();
        }
        if (phase === 'after' && f.reflectiveAura) {
          ctx.beginPath(); ctx.arc(f.x, f.y, 300, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,220,90,0.65)'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    };
    return cfg;
  }
};

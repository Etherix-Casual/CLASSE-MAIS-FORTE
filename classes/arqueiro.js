window.createBattleArcher = function (scope) {
  with (scope) {
    const basic = {
      lmb: { name: 'Flecha rápida', type: 'projectile', projType: 'arrow', cost: { sp: 5 }, damage: 8, stun: 0.08, speed: 1400, cooldown: 0.42 },
      rmb: { name: 'Flecha perfurante', type: 'chargedRelease' }
    };
    const cfg = {
      name: 'ARQUEIRO', hue: 95,
      stats: { hp: 145, resistance: 0.28, maxSpeed: 700, basicRange: 1250, resources: { vida: 145, stamina: 180, mana: 0, eter: 0, regen: { stamina: 6 } } },
      isPhysical: false,
      basic,
      immediateBasics: true,
      canStartBlock: () => false,
      isBlocking: () => false,
      canParry: false,
      canDash: false,
      onDeflect: () => false,
      aiArchetype: {
        style: { desiredMin: 750, desiredMax: 1050, keepDistance: true, retreatRange: 500 },
        projectileSpeed: 1400,
        chooseAction(f, opp, dist, roll) {
          if (dist > 300 && f.cd.skill_z <= 0 && roll < 0.1) return 'skill_z';
          if (dist < 500 && f.cd.skill_x <= 0 && roll < 0.15) return 'skill_x';
          if (dist > 700 && f.cd.skill_c <= 0 && roll < 0.1) return 'skill_c';
          if (dist > 450 && f.cd.skill_v <= 0 && roll < 0.12) return 'skill_v';
          if (f.cd.transform_b <= 0 && f.markTarget !== opp && roll < 0.05) return 'transform_b';
          if (f.cd.transform_t <= 0 && f.hawkEyeT <= 0 && roll < 0.035) return 'transform_t';
          if (dist > 600 && f.cd.transform_g <= 0 && roll < 0.045) return 'transform_g';
          if (dist > 700 && f.cd.ult2 <= 0 && roll < 0.045) return 'ult2';
          if (dist > 800 && f.cd.ult1 <= 0 && roll < 0.025) return 'ult1';
          return null;
        }
      },
      onCreate(f) { f.hawkEyeT = 0; f.markTarget = null; },
      projectileDamageMultiplier(f) { return f.hawkEyeT > 0 ? 2 : 1; },
      moveset: {
        lmb: (f, opp) => f.performBasicAttack(opp, f.aimAngle, 'lmb', basic.lmb, 'projectile'),
        rmb() {}
      },
      onBasicRelease(f, slot, opp, chargeDuration) {
        if (slot !== 'rmb' || f.cd.ataque_secundario > 0) return;
        const charge = Math.min(1, Math.max(0, chargeDuration));
        const cost = 20 + charge * 30;
        if (f.stamina < cost) return;
        f.resources.spend({ sp: cost });
        f.cd.ataque_secundario = 1.1;
        Projectiles.spawn({
          owner: f, x: f.x, y: f.y,
          vx: Math.cos(f.aimAngle) * 1750, vy: Math.sin(f.aimAngle) * 1750,
          type: 'arrow', damage: 15 + charge * 15, stun: 0.2,
          piercing: charge >= 1, unblockable: charge >= 1
        });
        Registro.obterEfeito('corte').criar({
          x: f.x + Math.cos(f.aimAngle) * 45, y: f.y + Math.sin(f.aimAngle) * 45,
          angle: f.aimAngle, length: 85 + charge * 40, hue: 105, life: 1, decay: 5, thickness: 8
        });
      },
      activateMove(f, slot, opp, intent) {
        const options = {
          z: { cost: { sp: 40 }, cooldown: 8, recovery: 0.4, data: { type: 'explosive-arrow' } },
          x: { cost: { sp: 30 }, cooldown: 10, recovery: 0.35, data: { type: 'backstep' } },
          c: { cost: { sp: 60 }, cooldown: 13, recovery: 0.6, data: { type: 'rain', x: intent.mouseWorldX, y: intent.mouseWorldY } },
          v: { cost: { sp: 35 }, cooldown: 9, recovery: 0.3, data: { type: 'homing-arrow' } },
          t: { cost: { sp: 40 }, cooldown: 45, recovery: 0.2, data: { type: 'hawk-eye' } },
          g: { cost: { sp: 60 }, cooldown: 32, recovery: 0.5, data: { type: 'piercing-line' } },
          b: { cost: { sp: 20 }, cooldown: 22, recovery: 0.2, data: { type: 'mark' } },
          h: { cost: { sp: 120 }, cooldown: 35, recovery: 0.4, data: { type: 'railgun', phase: 'charge' } },
          y: { cost: { sp: 180 }, cooldown: 70, recovery: 0.6, data: { type: 'judgment' } }
        }[slot];
        if (!options || !startMove(f, slot, opp, options)) return false;
        if (slot === 'y') startCinematic(f, 1.5);
        return true;
      },
      updatePassive(f, dt) {
        f.hawkEyeT = Math.max(0, f.hawkEyeT - dt);
        if (f.markTarget && f.markTime > 0) {
          f.markTime = Math.max(0, f.markTime - dt);
          if (!f.markTime) {
            f.markTarget.markedBy = null;
            f.markTarget.markTime = 0;
            f.markTarget = null;
          }
        }
      },
      updateSkill(f, dt, opp) {
        const data = f.skillData;
        if (!data) { finishMove(f); return; }
        data.elapsed += dt;
        const angle = f.aimAngle;
        switch (data.type) {
          case 'explosive-arrow':
            if (!data.fired) {
              Projectiles.spawn({
                owner: f, x: f.x, y: f.y, vx: Math.cos(angle) * 1150, vy: Math.sin(angle) * 1150,
                type: 'fire', damage: 25, stun: 0.3, status: { id: 'burning', dur: 5 },
                explosionRadius: 150
              });
              data.fired = true;
              finishMove(f, 0.35);
            }
            break;
          case 'backstep': {
            if (!data.fired) {
              Projectiles.spawn({ owner: f, x: f.x, y: f.y, vx: Math.cos(angle) * 1550, vy: Math.sin(angle) * 1550, type: 'arrow', damage: 12, stun: 0.12 });
              f.vx = -Math.cos(angle) * f.maxSpeed * 1.7;
              f.vy = -Math.sin(angle) * f.maxSpeed * 1.7;
              f.dodgeT = 0.3;
              data.fired = true;
            }
            if (data.elapsed > 0.25) finishMove(f, 0.3);
            break;
          }
          case 'rain': {
            if (!data.rained) {
              for (let i = 0; i < 8; i++) {
                const spread = (Math.random() - 0.5) * 560;
                Projectiles.spawn({
                  owner: f, x: data.x + spread, y: data.y - 420 - Math.random() * 80,
                  vx: (Math.random() - 0.5) * 100, vy: 1050,
                  type: 'arrow', damage: 16, stun: 0.1, life: 1.4
                });
              }
              data.rained = true;
              finishMove(f, 0.5);
            }
            break;
          }
          case 'homing-arrow':
            if (!data.fired) {
              Projectiles.spawn({ owner: f, x: f.x, y: f.y, vx: Math.cos(angle) * 900, vy: Math.sin(angle) * 900, type: 'arrow', damage: 20, stun: 0.18, homing: 1.5 });
              data.fired = true;
              finishMove(f);
            }
            break;
          case 'hawk-eye':
            f.hawkEyeT = 10;
            finishMove(f);
            break;
          case 'piercing-line':
            if (!data.fired) {
              Projectiles.spawn({ owner: f, x: f.x, y: f.y, vx: Math.cos(angle) * 2300, vy: Math.sin(angle) * 2300, type: 'arrow', damage: 60, stun: 0.5, piercing: true, unblockable: true, life: 3 });
              data.fired = true;
              finishMove(f, 0.4);
            }
            break;
          case 'mark':
            f.markTarget = opp;
            opp.markedBy = f;
            opp.markTime = 5;
            f.markTime = 5;
            finishMove(f);
            break;
          case 'railgun':
            data.charge = Math.min(1, (data.charge || 0) + dt);
            if (data.startedHeld && f.heldActions.has('ult2') && data.charge < 1) break;
            if (!data.beam) data.beam = Registro.obterEfeito('feixe').criar({
              owner: f, x: f.x, y: f.y, angle, width: 48, length: 1800,
              life: 2 + data.charge * 2, damage: 30, tick: 0, hue: 100,
              unblockable: data.charge >= 1, ignorarBarreira: data.charge >= 1, knockback: 220
            });
            data.beam.angle = angle;
            if (data.beam.life <= 0.1) finishMove(f, 0.4);
            break;
          case 'judgment':
            if (data.elapsed < 1) {
              f.judgmentDarkness = 1 - data.elapsed;
              for (let i = 0; i < 5; i++) spawnParticle(f.x + Math.cos(Math.random() * Math.PI * 2) * 160, f.y + Math.sin(Math.random() * Math.PI * 2) * 160, -Math.cos(angle) * 240, -Math.sin(angle) * 240, 45, 3, 1.4, 90);
            } else if (!data.fired) {
              f.judgmentDarkness = 0;
              Projectiles.spawn({ owner: f, x: f.x, y: f.y, vx: Math.cos(angle) * 2800, vy: Math.sin(angle) * 2800, type: 'arrow', damage: 100, stun: 0.7, piercing: true, unblockable: true, life: 2 });
              data.fired = true;
            }
            if (data.fired) finishMove(f, 0.6);
            break;
        }
      },
      draw(f, ctx, phase) {
        if (phase === 'after' && f.markTarget) {
          ctx.beginPath(); ctx.arc(f.markTarget.x, f.markTarget.y, 54, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,220,90,${Math.min(1, f.markTime / 2)})`;
          ctx.lineWidth = 4; ctx.setLineDash([8, 5]); ctx.stroke(); ctx.setLineDash([]);
        }
        if (phase === 'after' && f.judgmentDarkness > 0) {
          ctx.fillStyle = `rgba(0,0,0,${Math.min(0.72, f.judgmentDarkness * 0.72)})`;
          ctx.fillRect(0, 0, WORLD.w, WORLD.h);
        }
      }
    };
    return cfg;
  }
};

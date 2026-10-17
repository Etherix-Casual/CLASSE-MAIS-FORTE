window.createBattleMage = function (scope) {
  with (scope) {
    const elementTypes = ['fire', 'ice', 'electric', 'shadow', 'light'];
    const elementHues = [15, 190, 55, 280, 50];
    const basic = {
      lmb: { name: 'Orbe puro', type: 'projectile', projType: 'pure_orb', cost: { mp: 5 }, damage: 6, stun: 0.08, speed: 950, cooldown: 0.3 },
      rmb: { name: 'Orbe teleguiado', type: 'projectile', projType: 'homing_orb', cost: { mp: 25 }, damage: 10, stun: 0.12, speed: 650, homing: 1.5, cooldown: 0.75 }
    };
    const cfg = {
      name: 'MAGO', hue: 280,
      stats: { hp: 130, resistance: 0.48, maxSpeed: 530, basicRange: 900, resources: { vida: 130, stamina: 80, mana: 900, eter: 0, regen: { mana: 10, stamina: 5 } } },
      isPhysical: false,
      basic,
      immediateBasics: true,
      aiArchetype: {
        style: { desiredMin: 650, desiredMax: 950, keepDistance: true, retreatRange: 420 },
        projectileSpeed: 900,
        onThreat: (f, threat) => f.arcaneBarrierActive && !threat.unblockable ? 'escudo' : null,
        chooseAction(f, opp, dist, roll) {
          if (dist < 450 && f.cd.skill_v <= 0 && f.mana >= 150 && roll < 0.12) return 'skill_v';
          if (dist > 280 && f.cd.skill_x <= 0 && f.mana >= 40 && roll < 0.12) return 'skill_x';
          if (dist < 700 && f.cd.skill_z <= 0 && f.mana >= 100 && roll < 0.15) return 'skill_z';
          if (f.cd.transform_b <= 0 && !f.arcaneBarrierActive && f.mana > 120 && roll < 0.06) return 'transform_b';
          if (dist < 950 && f.cd.ult2 <= 0 && f.mana >= 180 && roll < 0.07) return 'ult2';
          if (dist > 550 && f.cd.skill_c <= 0 && f.mana >= 120 && roll < 0.1) return 'skill_c';
          if (f.hp < f.maxHp * 0.4 && f.cd.transform_t <= 0 && f.mana >= 200 && roll < 0.05) return 'transform_t';
          if (f.cd.ult1 <= 0 && f.mana >= 750 && roll < 0.02) return 'ult1';
          return null;
        }
      },
      onCreate(f) { f.teleportStack = 0; f.teleportReset = 0; },
      meditation: { vida: 2, mana: 45, stamina: 10 },
      canStartBlock: () => false,
      isBlocking: f => !!f.arcaneBarrierActive && f.mana > 0,
      canParry: false,
      customBlockDraw: true,
      canDash: false,
      onAbsorb(f, damage) {
        if (!f.arcaneBarrierActive) return false;
        const cost = damage * 2.5;
        if (f.mana < cost) {
          f.mana = 0;
          f.arcaneBarrierActive = false;
          return false;
        }
        f.resources.spend({ mp: cost });
        return true;
      },
      onDeflect: () => false,
      onAwaken: () => ({}),
      moveset: {
        lmb: (f, opp) => f.performBasicAttack(opp, f.aimAngle, 'lmb', basic.lmb, 'projectile'),
        rmb: (f, opp) => f.performBasicAttack(opp, f.aimAngle, 'rmb', basic.rmb, 'projectile')
      },
      activateMove(f, slot, opp, intent) {
        if (slot === 'b' && f.arcaneBarrierActive) return false;
        const options = {
          z: { cost: { mp: 100 }, cooldown: 7, recovery: 0.4, data: { type: 'elemental-burst', phase: 'charge', charge: 0 } },
          x: { cost: {}, cooldown: 8, recovery: 0.25, data: { type: 'teleport', targetX: intent.mouseWorldX, targetY: intent.mouseWorldY } },
          c: { cost: { mp: 120 }, cooldown: 14, recovery: 0.5, data: { type: 'orb-rain', phase: 'charge', count: 0, charge: 0 } },
          v: { cost: { mp: 150 }, cooldown: 18, recovery: 0.45, data: { type: 'small-hole', phase: 'charge', charge: 0, targetX: intent.mouseWorldX, targetY: intent.mouseWorldY } },
          g: { cost: { mp: 180 }, cooldown: 22, recovery: 0.45, data: { type: 'vortex', targetX: intent.mouseWorldX, targetY: intent.mouseWorldY } },
          b: { cost: { mp: 50 }, cooldown: 1, recovery: 0.1, data: { type: 'barrier' } },
          t: { cost: { mp: 200 }, cooldown: 25, recovery: 0.2, data: { type: 'emergency-teleport', targetX: intent.mouseWorldX, targetY: intent.mouseWorldY } },
          y: { cost: { mp: 750 }, cooldown: 75, recovery: 0.8, data: { type: 'apocalypse', targetX: intent.mouseWorldX, targetY: intent.mouseWorldY } },
          h: { cost: { mp: 200 }, cooldown: 28, recovery: 0.5, data: { type: 'prismal', phase: 'channel', charge: 0 } }
        }[slot];
        if (!options || !startMove(f, slot, opp, options)) return false;
        if (slot === 'y' || slot === 'g') startCinematic(f, slot === 'y' ? 2.5 : 1.5);
        return true;
      },
      updatePassive(f, dt) {
        if (f.teleportReset > 0) {
          f.teleportReset -= dt;
          if (f.teleportReset <= 0) f.teleportStack = 0;
        }
        if (f.arcaneBarrierActive && f.mana <= 0) f.arcaneBarrierActive = false;
      },
      updateSkill(f, dt, opp) {
        const data = f.skillData;
        if (!data) { finishMove(f); return; }
        data.elapsed += dt;
        const held = data.startedHeld && f.heldActions.has(
          data.slot === 'y' ? 'ult1' : data.slot === 'h' ? 'ult2' : `skill_${data.slot}`
        );
        const chargeWithMana = (maximum, rate) => {
          const charge = Math.min(dt, maximum - (data.charge || 0), f.mana / rate);
          if (charge <= 0) return;
          data.charge = (data.charge || 0) + charge;
          f.resources.spend({ mp: charge * rate });
        };
        const element = () => elementTypes[f.elementIndex++ % elementTypes.length];
        switch (data.type) {
          case 'elemental-burst':
            if (held && data.charge < 1) chargeWithMana(1, 50);
            if (!held || data.charge >= 1 || f.mana <= 0) {
              const scale = 1 + data.charge * 0.5;
              for (let i = -2; i <= 2; i++) {
                const angle = f.aimAngle + i * 0.11;
                Projectiles.spawn({
                  owner: f, x: f.x, y: f.y, vx: Math.cos(angle) * 980, vy: Math.sin(angle) * 980,
                  type: element(), damage: 12 * scale, radius: 18 * scale, stun: 0.16
                });
              }
              finishMove(f, 0.35);
            }
            break;
          case 'teleport': {
            const dx = data.targetX - f.x, dy = data.targetY - f.y;
            const distance = Math.hypot(dx, dy);
            const cost = Math.min(672, Math.max(118, 40 + Math.pow(distance, 1.5) * 0.02));
            if (f.mana < cost) { finishMove(f, 0.1); break; }
            f.resources.spend({ mp: cost });
            const oldX = f.x, oldY = f.y;
            const scale = Math.min(1, 520 / (distance || 1));
            f.x = Math.max(60, Math.min(WORLD.w - 60, f.x + dx * scale));
            f.y = Math.max(60, Math.min(WORLD.h - 60, f.y + dy * scale));
            addExplosion(oldX, oldY, f.hue, 0.65, false);
            addExplosion(f.x, f.y, f.hue, 0.9, false);
            f.teleportStack++;
            f.teleportReset = 5;
            finishMove(f, 0.2);
            break;
          }
          case 'orb-rain':
            if (held && data.charge < 1) chargeWithMana(1, 160);
            if (!held || data.charge >= 1 || f.mana <= 0) {
              data.total = 10 + Math.floor(data.charge * 20);
              data.duration = 0.8 + data.charge * 2.2;
              data.tick = 0;
              data.phase = 'fire';
            }
            if (data.phase === 'fire') {
              data.tick += dt;
              const interval = data.duration / data.total;
              while (data.tick >= interval && data.count < data.total) {
                data.tick -= interval;
                const angle = f.aimAngle + (Math.random() - 0.5) * 0.52;
                const type = element();
                Projectiles.spawn({ owner: f, x: f.x, y: f.y, vx: Math.cos(angle) * 850, vy: Math.sin(angle) * 850, type, damage: 13, stun: 0.12 });
                data.count++;
              }
              if (data.count >= data.total) finishMove(f, 0.4);
            }
            break;
          case 'small-hole':
            if (held && data.charge < 3) chargeWithMana(3, 50);
            if (!held || data.charge >= 3 || f.mana <= 0) {
              const targetX = Math.max(70, Math.min(WORLD.w - 70, data.targetX));
              const targetY = Math.max(70, Math.min(WORLD.h - 70, data.targetY));
              Registro.obterEfeito('vortice').criar({
                owner: f, x: targetX, y: targetY, vx: 0, vy: 0, hue: f.hue,
                life: 3 + Math.min(3, data.charge), radius: 68, influenceR: 400,
                pullForce: 1200, damage: 20, tick: 0
              });
              finishMove(f, 0.4);
            }
            break;
          case 'vortex':
            if (!data.created) {
              Registro.obterEfeito('vortice').criar({
                owner: f, x: data.targetX, y: data.targetY, vx: 0, vy: 0, hue: f.hue,
                life: 5, radius: 95, influenceR: 600, pullForce: 1700, damage: 8,
                tick: 0, excludeShadow: true
              });
              data.created = true;
            }
            if (data.elapsed > 0.3) finishMove(f, 0.4);
            break;
          case 'barrier':
            f.arcaneBarrierActive = true;
            finishMove(f, 0.1);
            break;
          case 'emergency-teleport': {
            const oldX = f.x, oldY = f.y;
            f.x = Math.max(60, Math.min(WORLD.w - 60, data.targetX));
            f.y = Math.max(60, Math.min(WORLD.h - 60, data.targetY));
            f.immuneT = Math.max(f.immuneT, 0.35);
            addExplosion(oldX, oldY, f.hue, 1, false);
            addExplosion(f.x, f.y, f.hue, 1, false);
            finishMove(f);
            break;
          }
          case 'apocalypse':
            if (data.elapsed < 2.5) {
              const progress = data.elapsed / 2.5;
              f.apocalypseDarkness = 1 - progress;
              for (let i = 0; i < 7; i++) {
                const angle = Math.random() * Math.PI * 2;
                const radius = 300 * (1 - progress);
                spawnParticle(f.x + Math.cos(angle) * radius, f.y + Math.sin(angle) * radius, -Math.cos(angle) * 420, -Math.sin(angle) * 420, 280, 3 + progress * 5, 1.4, 90);
              }
            } else if (!data.launched) {
              f.apocalypseDarkness = 0;
              const dx = data.targetX - f.x, dy = data.targetY - f.y;
              const angle = Math.atan2(dy, dx);
              Registro.obterEfeito('vortice').criar({
                owner: f, x: f.x, y: f.y, vx: Math.cos(angle) * 800, vy: Math.sin(angle) * 800,
                hue: 280, life: 8, radius: 95, influenceR: 230, pullForce: 1000,
                damage: 75, tick: 0, unblockable: true, excludeShadow: true
              });
              addExplosion(f.x, f.y, 280, 2.8, true);
              data.launched = true;
            }
            if (data.launched) finishMove(f, 0.8);
            break;
          case 'prismal':
            if (!data.beam) {
              if (held && data.charge < 1) chargeWithMana(1, 60);
              if (held && data.charge < 1 && f.mana > 0) break;
              data.beam = Registro.obterEfeito('feixe').criar({
                owner: f, x: f.x, y: f.y, angle: f.aimAngle, width: 100, length: 900,
                life: 2 + data.charge * 2, damage: 12, tick: 0, hue: 190, knockback: 480, ignorarBarreira: true
              });
              data.beam.charge = data.charge;
            }
            data.beam.angle = f.aimAngle;
            if (data.beam && data.beam.life <= 0.1) {
              data.beam.life = Math.min(data.beam.life, 0.1);
              finishMove(f, 0.4);
            }
            break;
        }
      },
      draw(f, ctx, phase) {
        if (phase === 'after' && f.apocalypseDarkness > 0) {
          ctx.fillStyle = `rgba(0,0,0,${Math.min(0.72, f.apocalypseDarkness * 0.72)})`;
          ctx.fillRect(0, 0, WORLD.w, WORLD.h);
        }
        if (phase !== 'after' || !f.arcaneBarrierActive) return;
        const radius = 78 + Math.sin(state.time * 5) * 3;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(state.time * 0.6);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3;
          const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
          if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(155,90,255,0.16)';
        ctx.strokeStyle = 'rgba(210,170,255,0.9)';
        ctx.lineWidth = 4;
        ctx.fill(); ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const angle = state.time * 1.8 + i * Math.PI / 3;
          ctx.beginPath(); ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#e4c8ff'; ctx.fill();
        }
        ctx.restore();
      },
      hudExtras(f) {
        return f.arcaneBarrierActive ? [`BARREIRA ${Math.ceil(f.mana)} MP`] : [];
      }
    };
    return cfg;
  }
};

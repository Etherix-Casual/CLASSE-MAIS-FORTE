window.createBattleInvoker = function (scope) {
  with (scope) {
    const basic = {
      lmb: { name: 'Pulso de éter', type: 'strike', instant: true, damage: 5, stun: 0.05, range: 105, halfAngle: 0.8, cooldown: 0.36 },
      rmb: { name: 'Marcação', type: 'mark' }
    };
    const cfg = {
      name: 'INVOCADOR', hue: 165,
      stats: { hp: 155, resistance: 0.32, maxSpeed: 620, basicRange: 650, resources: { vida: 155, stamina: 90, mana: 0, eter: 240, regen: { stamina: 5 } } },
      isPhysical: false,
      basic,
      immediateBasics: true,
      canStartBlock: () => false,
      isBlocking: () => false,
      canParry: false,
      canDash: false,
      onDeflect: () => false,
      aiArchetype: {
        style: { desiredMin: 450, desiredMax: 700, keepDistance: true, retreatRange: 320 },
        projectileSpeed: 700,
        onThreat: (f, threat) => Minions.units.some(unit => unit.owner === f && unit.type === 'defender' && !threat.unblockable) ? 'transform_b' : null,
        chooseAction(f, opp, dist, roll) {
          const minions = Minions.units.filter(unit => unit.owner === f);
          if (f.eter < 35 && f.cd.transform_g <= 0) return 'transform_g';
          if (!minions.some(unit => unit.type === 'defender') && f.eter >= 30 && f.cd.skill_x <= 0 && roll < 0.15) return 'skill_x';
          if (!minions.some(unit => unit.type === 'shooter') && f.eter >= 30 && f.cd.skill_z <= 0 && roll < 0.12) return 'skill_z';
          if (!minions.some(unit => unit.type === 'pursuer') && f.eter >= 30 && f.cd.skill_c <= 0 && roll < 0.12) return 'skill_c';
          if (minions.length && f.cd.skill_v <= 0 && dist < 500 && roll < 0.1) return 'skill_v';
          if (minions.length && f.cd.transform_b <= 0 && roll < 0.08) return 'transform_b';
          if (f.cd.transform_t <= 0 && roll < 0.05) return 'transform_t';
          if (f.eter >= 60 && f.cd.ult2 <= 0 && roll < 0.035) return 'ult2';
          if (f.eter >= 100 && f.cd.ult1 <= 0 && roll < 0.02) return 'ult1';
          return null;
        }
      },
      moveset: {
        lmb: (f, opp) => f.performBasicAttack(opp, f.aimAngle, 'lmb', basic.lmb, 'pulse'),
        rmb(f, opp) {
          if (f.cd.ataque_secundario > 0 || f.eter < 5) return;
          f.resources.spend({ eter: 5 });
          f.cd.ataque_secundario = 1.5;
          opp.vulnerabilityOwner = f;
          opp.vulnerabilityMultiplier = 1.1;
          opp.vulnerabilityTime = 5;
          Registro.obterEfeito('captacao-particulas').criar({ x: opp.x, y: opp.y, hue: 165, radius: 55, intensidade: 1.3 });
        }
      },
      activateMove(f, slot, opp, intent) {
        if (slot === 'v' && !Minions.units.some(unit => unit.owner === f && unit.hp > 0)) return false;
        const options = {
          z: { cost: { eter: 30 }, cooldown: 7, recovery: 0.3, data: { type: 'summon', unit: 'shooter' } },
          x: { cost: { eter: 30 }, cooldown: 10, recovery: 0.3, data: { type: 'summon', unit: 'defender' } },
          c: { cost: { eter: 30 }, cooldown: 8, recovery: 0.3, data: { type: 'summon', unit: 'pursuer' } },
          v: { cost: {}, cooldown: 13, recovery: 0.5, data: { type: 'sacrifice' } },
          t: { cost: {}, cooldown: 55, recovery: 0.2, data: { type: 'banquet' } },
          g: { cost: {}, cooldown: 1, recovery: 0.2, data: { type: 'gather' } },
          b: { cost: {}, cooldown: 24, recovery: 0.35, data: { type: 'minion-wall' } },
          h: { cost: { eter: 60 }, cooldown: 42, recovery: 0.7, data: { type: 'conjure', unit: 'angel', x: intent.mouseWorldX, y: intent.mouseWorldY } },
          y: { cost: { eter: 100 }, cooldown: 65, recovery: 0.8, data: { type: 'conjure', unit: 'entity', x: intent.mouseWorldX, y: intent.mouseWorldY } }
        }[slot];
        if (!options || !startMove(f, slot, opp, options)) return false;
        if (slot === 'h' || slot === 'y') startCinematic(f, 1.5);
        return true;
      },
      updateSkill(f, dt, opp) {
        const data = f.skillData;
        if (!data) { finishMove(f); return; }
        data.elapsed += dt;
        switch (data.type) {
          case 'summon':
            Minions.spawn(f, data.unit, f.x + Math.cos(f.aimAngle) * 72, f.y + Math.sin(f.aimAngle) * 72);
            finishMove(f);
            break;
          case 'sacrifice': {
            const unit = Minions.sacrifice(f);
            if (unit) {
              Registro.obterEfeito('explosao').criar({ x: unit.x, y: unit.y, hue: f.hue, power: 1.8, big: true, onda: { maxR: 200, speed: 1000 } });
              if (Math.hypot(opp.x - unit.x, opp.y - unit.y) <= 200) {
                f.applyHit(opp, 25, Math.atan2(opp.y - unit.y, opp.x - unit.x), 550, 0.35, null, true);
              }
            }
            finishMove(f, 0.4);
            break;
          }
          case 'banquet':
            for (const unit of Minions.units) {
              if (unit.owner !== f) continue;
              unit.hp = Math.min(unit.maxHp * 1.5, unit.hp * 1.5);
              unit.maxHp *= 1.5;
              unit.empoweredTime = 10;
            }
            finishMove(f);
            break;
          case 'gather':
            if (!f.isPlayer || (data.startedHeld && f.heldActions.has('transform_g'))) {
              f.resources.restore('eter', 20 * dt);
              if (Math.random() < 0.5) spawnParticle(f.x + (Math.random() - 0.5) * 100, f.y + (Math.random() - 0.5) * 100, 0, -80, 165, 3, 1.5, 85);
            } else if (data.elapsed >= 1 || !data.startedHeld) finishMove(f);
            break;
          case 'minion-wall':
            Minions.beginBarrier(f, 3);
            Registro.obterEfeito('explosao').criar({ x: f.x, y: f.y, hue: 165, explosao: false, onda: { maxR: 220, speed: 800 }, shake: false });
            finishMove(f, 0.3);
            break;
          case 'conjure':
            if (data.elapsed < 1.5) {
              const radius = 110 * (1 - data.elapsed / 1.5);
              for (let i = 0; i < 4; i++) {
                const angle = Math.random() * Math.PI * 2;
                spawnParticle(data.x + Math.cos(angle) * radius, data.y + Math.sin(angle) * radius, -Math.cos(angle) * 180, -Math.sin(angle) * 180, data.unit === 'angel' ? 50 : 280, 4, 1.5, 90);
              }
            } else {
              const unit = Minions.spawn(f, data.unit, data.x, data.y, data.unit === 'angel' ? 8 : 10);
              unit.anchorX = data.x;
              unit.anchorY = data.y;
              addExplosion(data.x, data.y, data.unit === 'angel' ? 50 : 280, 2.4, true);
              finishMove(f, 0.7);
            }
            break;
        }
      },
      hudExtras(f) {
        const count = Minions.units.filter(unit => unit.owner === f).length;
        return [`ÉTER ${Math.floor(f.eter)}/${Math.floor(f.maxEter)}`, `INVOCADOS ${count}`];
      }
    };
    return cfg;
  }
};

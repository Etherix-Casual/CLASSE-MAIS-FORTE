window.Minions = (() => {
  const WORLD = window.BattleData.WORLD;
  const Projectiles = window.Projectiles;
  const units = [];
  const crystals = [];
  let crystalTimer = 0;

  class Minion {
    constructor(owner, type, x, y, duration = 15) {
      this.owner = owner;
      this.type = type;
      this.side = owner.side;
      this.x = x;
      this.y = y;
      this.hp = type === 'defender' ? 50 : type === 'shooter' ? 30 : type === 'pursuer' ? 25 : type === 'angel' ? 60 : 100;
      this.maxHp = this.hp;
      this.life = duration;
      this.resistance = 0;
      this._awakenedDefense = 1;
      this._dmgTakenMul = 1;
      this.vx = 0;
      this.vy = 0;
      this.tick = 0;
      this.cooldown = Math.random() * 0.2;
      this.bodyRadius = type === 'entity' ? 90 : type === 'angel' ? 58 : 27;
      this.dead = false;
      this.barrierTime = 0;
      this.knockbackVx = 0;
      this.knockbackVy = 0;
      this.state = 'idle';
      this.statuses = {};
    }

    isImmune() { return false; }
    isParrying() { return false; }
    isBlocking() { return false; }
    tryAbsorbArcane() { return false; }
    applyStatus() {}
    applyHit(target, damage, angle, knockback, stun, status, big, unblockable) {
      this.owner.applyHit(target, damage, angle, knockback, stun, status, big, unblockable);
    }
  }

  function spawn(owner, type, x, y, duration) {
    const unit = new Minion(owner, type, x, y, duration);
    units.push(unit);
    return unit;
  }

  function beginBarrier(owner, duration = 3) {
    let count = 0;
    for (const unit of units) {
      if (unit.owner !== owner) continue;
      unit.barrierTime = duration;
      count++;
    }
    return count;
  }

  function sacrifice(owner) {
    const index = units.findIndex(unit => unit.owner === owner && unit.hp > 0);
    if (index < 0) return null;
    return units.splice(index, 1)[0];
  }

  function update(dt, blueF, redF) {
    crystalTimer -= dt;
    if (crystalTimer <= 0 && crystals.length < 10) {
      crystalTimer = 7;
      crystals.push({
        x: 140 + Math.random() * (WORLD.w - 280),
        y: 140 + Math.random() * (WORLD.h - 280),
        life: 35,
        hue: 165
      });
    }
    for (let i = crystals.length - 1; i >= 0; i--) {
      const crystal = crystals[i];
      crystal.life -= dt;
      for (const fighter of [blueF, redF]) {
        if (fighter.classKey === 'invocador' && Math.hypot(fighter.x - crystal.x, fighter.y - crystal.y) < 55) {
          fighter.resources.restore('eter', 20);
          crystals.splice(i, 1);
          break;
        }
      }
      if (crystal.life <= 0) crystals.splice(i, 1);
    }

    for (let i = units.length - 1; i >= 0; i--) {
      const unit = units[i];
      const target = unit.owner === blueF ? redF : blueF;
      if (unit.hp <= 0 || unit.life <= 0 || unit.owner.hp <= 0) {
        units.splice(i, 1);
        continue;
      }
      unit.life -= dt;
      if (unit.empoweredTime > 0) unit.empoweredTime = Math.max(0, unit.empoweredTime - dt);
      unit.cooldown = Math.max(0, unit.cooldown - dt);
      unit.tick -= dt;
      if (unit.barrierTime > 0) {
        unit.barrierTime -= dt;
        const angle = Math.atan2(target.y - unit.owner.y, target.x - unit.owner.x);
        const formation = units.filter(other => other.owner === unit.owner && other.barrierTime > 0);
        const index = formation.indexOf(unit);
        const offset = (index - (formation.length - 1) / 2) * 52;
        const forward = unit.type === 'defender' ? 115 : 90;
        unit.x = unit.owner.x + Math.cos(angle) * forward - Math.sin(angle) * offset;
        unit.y = unit.owner.y + Math.sin(angle) * forward + Math.cos(angle) * offset;
        continue;
      }

      if (unit.type === 'defender') {
        const angle = Math.atan2(target.y - unit.owner.y, target.x - unit.owner.x);
        unit.x += (unit.owner.x + Math.cos(angle) * 100 - unit.x) * Math.min(1, dt * 5);
        unit.y += (unit.owner.y + Math.sin(angle) * 100 - unit.y) * Math.min(1, dt * 5);
      } else if (unit.type === 'shooter') {
        const distance = Math.hypot(target.x - unit.x, target.y - unit.y);
        if (distance < 330) {
          unit.x += (unit.x - target.x) / (distance || 1) * 180 * dt;
          unit.y += (unit.y - target.y) / (distance || 1) * 180 * dt;
        }
        if (unit.cooldown <= 0 && distance < 1050) {
          const angle = Math.atan2(target.y - unit.y, target.x - unit.x);
          Projectiles.spawn({ owner: unit, x: unit.x, y: unit.y, vx: Math.cos(angle) * 950, vy: Math.sin(angle) * 950, type: 'light', damage: 8 * (unit.empoweredTime > 0 ? 1.5 : 1), stun: 0.08 });
          unit.cooldown = 1;
        }
      } else if (unit.type === 'pursuer') {
        const dx = target.x - unit.x, dy = target.y - unit.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance > 64) {
          unit.x += dx / distance * 300 * dt;
          unit.y += dy / distance * 300 * dt;
        } else if (unit.tick <= 0) {
          const empowered = unit.empoweredTime > 0 ? 1.5 : 1;
          unit.owner.applyHit(target, 4 * empowered, Math.atan2(dy, dx), 160, 0.12, null);
          unit.tick = 0.5;
        }
      } else if (unit.type === 'angel') {
        unit.x += (unit.anchorX - unit.x) * Math.min(1, dt * 2);
        unit.y += (unit.anchorY - unit.y) * Math.min(1, dt * 2);
        if (unit.tick <= 0) {
          if (Math.hypot(target.x - unit.x, target.y - unit.y) < 300) {
            unit.owner.applyHit(target, 20, Math.atan2(target.y - unit.y, target.x - unit.x), 280, 0.15, { id: 'cursed', dur: 4 });
          }
          unit.tick = 2;
        }
      } else if (unit.type === 'entity') {
        unit.x += (unit.anchorX - unit.x) * Math.min(1, dt);
        unit.y += (unit.anchorY - unit.y) * Math.min(1, dt);
        if (Math.hypot(target.x - unit.x, target.y - unit.y) < 400) {
          target._fearTime = 0.2;
          target._fearMultiplier = 0.7;
          if (unit.tick <= 0) {
            unit.owner.applyHit(target, 15, Math.atan2(target.y - unit.y, target.x - unit.x), 220, 0.1, null);
            unit.tick = 0.5;
          }
        }
      }
      unit.x = Math.max(40, Math.min(WORLD.w - 40, unit.x));
      unit.y = Math.max(40, Math.min(WORLD.h - 40, unit.y));
    }
  }

  function intercept(projectile, target) {
    let nearest = null;
    let nearestDistance = Infinity;
    const sx = projectile.x - (projectile.prevX === undefined ? projectile.x : projectile.prevX);
    const sy = projectile.y - (projectile.prevY === undefined ? projectile.y : projectile.prevY);
    const segmentLength = sx * sx + sy * sy || 1;
    for (const unit of units) {
      if (unit.owner.side === projectile.owner.side || unit.hp <= 0) continue;
      const projection = Math.max(0, Math.min(1, ((unit.x - projectile.x + sx) * sx + (unit.y - projectile.y + sy) * sy) / segmentLength));
      const distance = Math.hypot(unit.x - (projectile.x - sx + sx * projection), unit.y - (projectile.y - sy + sy * projection));
      if (distance <= unit.bodyRadius + projectile.radius && distance < nearestDistance) {
        nearest = unit;
        nearestDistance = distance;
      }
    }
    if (!nearest) return false;
    if (projectile.explosionRadius > 0) {
      for (const unit of units) {
        if (unit.owner.side !== projectile.owner.side && Math.hypot(unit.x - projectile.x, unit.y - projectile.y) <= projectile.explosionRadius) {
          unit.hp = Math.max(0, unit.hp - projectile.damage);
        }
      }
      if (target && Math.hypot(target.x - projectile.x, target.y - projectile.y) <= projectile.explosionRadius) {
        projectile.owner.applyHit(
          target, projectile.damage, Math.atan2(target.y - projectile.y, target.x - projectile.x),
          220, 0.1, projectile.status, true, projectile.unblockable
        );
      }
    } else nearest.hp = Math.max(0, nearest.hp - projectile.damage);
    return true;
  }

  function draw(ctx) {
    for (const crystal of crystals) {
      ctx.beginPath();
      ctx.moveTo(crystal.x, crystal.y - 9);
      ctx.lineTo(crystal.x + 8, crystal.y);
      ctx.lineTo(crystal.x, crystal.y + 9);
      ctx.lineTo(crystal.x - 8, crystal.y);
      ctx.closePath();
      ctx.fillStyle = `hsla(${crystal.hue},100%,70%,0.85)`;
      ctx.fill();
      ctx.strokeStyle = '#dffff7';
      ctx.stroke();
    }
    for (const unit of units) {
      const hue = unit.type === 'angel' ? 50 : unit.type === 'entity' ? 280 : unit.owner.hue;
      ctx.beginPath();
      ctx.arc(unit.x, unit.y, unit.bodyRadius, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue},85%,55%,${unit.type === 'defender' ? 0.75 : 0.55})`;
      ctx.fill();
      ctx.lineWidth = unit.barrierTime > 0 ? 6 : 3;
      ctx.strokeStyle = unit.barrierTime > 0 ? '#e9ffff' : `hsla(${hue},100%,85%,0.9)`;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(unit.type === 'shooter' ? 'A' : unit.type === 'defender' ? 'D' : unit.type === 'pursuer' ? 'P' : unit.type === 'angel' ? '✦' : '◉', unit.x, unit.y + 4);
      ctx.fillStyle = '#111';
      ctx.fillRect(unit.x - 22, unit.y - unit.bodyRadius - 12, 44, 4);
      ctx.fillStyle = '#9cffd0';
      ctx.fillRect(unit.x - 22, unit.y - unit.bodyRadius - 12, 44 * unit.hp / unit.maxHp, 4);
    }
  }

  function clear() {
    units.length = 0;
    crystals.length = 0;
    crystalTimer = 0;
  }

  return { units, spawn, beginBarrier, sacrifice, update, intercept, draw, clear };
})();

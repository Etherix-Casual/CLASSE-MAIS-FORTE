/* ============================================================
   ia.js — IA por classe → intent
   ============================================================ */
window.AI = (() => {
  const AI_LEVELS = window.BattleData.AI_LEVELS;

  const Steering = {
    arrive(f, x, y, dt, maxSpeed, radius = 120) {
      const dx = x - f.x, dy = y - f.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 1) return { x: f.vx, y: f.vy };
      const speed = Math.min(maxSpeed, distance / radius * maxSpeed);
      return this.accelerate(f, dx / distance * speed, dy / distance * speed, dt, maxSpeed);
    },
    flee(f, x, y, dt, maxSpeed) {
      const dx = f.x - x, dy = f.y - y;
      const distance = Math.hypot(dx, dy) || 1;
      return this.accelerate(f, dx / distance * maxSpeed, dy / distance * maxSpeed, dt, maxSpeed);
    },
    wander(f, velocity, dt, amount = 80) {
      f.wanderPhase = (f.wanderPhase || Math.random() * Math.PI * 2) + dt * 2.5;
      return {
        x: velocity.x + Math.cos(f.wanderPhase) * amount * dt,
        y: velocity.y + Math.sin(f.wanderPhase * 0.7) * amount * dt
      };
    },
    drag(velocity, dt, strength = 4.5) {
      const factor = Math.exp(-strength * dt);
      return { x: velocity.x * factor, y: velocity.y * factor };
    },
    accelerate(f, desiredX, desiredY, dt, maxSpeed) {
      const maxDelta = maxSpeed * 5 * dt;
      return {
        x: f.vx + Math.max(-maxDelta, Math.min(maxDelta, desiredX - f.vx)),
        y: f.vy + Math.max(-maxDelta, Math.min(maxDelta, desiredY - f.vy))
      };
    },
    clamp(velocity, maxSpeed) {
      const speed = Math.hypot(velocity.x, velocity.y);
      if (speed <= maxSpeed) return velocity;
      return { x: velocity.x / speed * maxSpeed, y: velocity.y / speed * maxSpeed };
    }
  };

  const MEM = new WeakMap();
  function getMem(f) {
    let m = MEM.get(f);
    if (!m) {
      m = {
        decideTimer: 0, strafeSign: Math.random() < 0.5 ? -1 : 1, strafeTimer: 0,
        observeTimer: 0, queuedReaction: null, combatTime: 0, aimTimer: 0,
        aimError: 0, lastOpp: null, misread: false
      };
      MEM.set(f, m);
    }
    return m;
  }

  function threatProjectile(f, projs, perceptionR = 420) {
    let nearest = null, nearestT = Infinity;
    for (const p of projs) {
      if (p.owner === f || p.dead) continue;
      const dx = p.x - f.x, dy = p.y - f.y;
      const d = Math.hypot(dx, dy);
      if (d > perceptionR || d < 1) continue;
      const pSpeed = Math.hypot(p.vx, p.vy) || 1;
      const dot = (dx * p.vx + dy * p.vy) / (d * pSpeed);
      if (dot < -0.5) {
        const t = d / pSpeed;
        if (t < nearestT) { nearestT = t; nearest = p; }
      }
    }
    return nearest;
  }

  function decide(f, opp, dt, ctx) {
    const mem = getMem(f);
    const level = Math.max(1, Math.min(7, Math.round(f.aiLevel || 7)));
    const human = AI_LEVELS[level];
    const humanized = level < 7;
    const reactionDt = ctx.realDt === undefined ? dt : ctx.realDt;
    if (humanized) mem.combatTime += reactionDt;
    mem.decideTimer -= dt;
    const observingAtFrameStart = mem.observeTimer > 0;
    mem.observeTimer = Math.max(0, mem.observeTimer - reactionDt);
    mem.aimTimer -= dt;

    const intent = {
      moveX: 0, moveY: 0,
      moveVx: f.vx, moveVy: f.vy,
      aimAngle: f.aimAngle,
      actions: new Set()
    };

    const cfg = f.classCfg;
    const style = cfg.aiArchetype.style;
    const panic = humanized && f.hp / f.maxHp < 0.3 ? human.panic : 0;
    let targetX = opp.x, targetY = opp.y;
    if (humanized && mem.decideTimer <= 0) {
      mem.misread = Math.random() < human.misread;
      if (mem.misread && mem.lastOpp) {
        targetX = mem.lastOpp.x;
        targetY = mem.lastOpp.y;
      }
      mem.lastOpp = { x: opp.x, y: opp.y };
      if (!observingAtFrameStart && Math.random() < human.observe) {
        mem.observeTimer = 0.3 + Math.random() * 0.3;
        mem.decideTimer = 0.15 + Math.random() * 0.2;
      }
    }
    if (humanized && mem.aimTimer <= 0) {
      const distance = Math.hypot(targetX - f.x, targetY - f.y);
      const ratio = Math.min(1, distance / 1200);
      const error = human.aimNear + (human.aimFar - human.aimNear) * ratio;
      mem.aimError = (Math.random() * 2 - 1) * error;
      mem.aimTimer = 0.12 + Math.random() * 0.14;
    } else if (!humanized) {
      mem.aimError = 0;
    }
    const aimSpeed = cfg.aiArchetype.projectileSpeed || Math.max(500, f.maxSpeed);
    const leadTime = Math.min(0.8, Math.hypot(targetX - f.x, targetY - f.y) / aimSpeed);
    const predictedX = targetX + (opp.vx || 0) * leadTime;
    const predictedY = targetY + (opp.vy || 0) * leadTime;
    intent.aimAngle = Math.atan2(predictedY - f.y, predictedX - f.x) + mem.aimError;
    intent.mouseWorldX = predictedX;
    intent.mouseWorldY = predictedY;
    const dx = targetX - f.x, dy = targetY - f.y;
    const dist = Math.hypot(dx, dy);

    if (mem.queuedReaction) {
      mem.queuedReaction.timer -= reactionDt;
      if (mem.queuedReaction.timer <= 0) {
        intent.actions.add(mem.queuedReaction.action);
        mem.queuedReaction = null;
        return intent;
      }
    }

    if (humanized && mem.observeTimer > 0) return intent;

    // DEFESA
    const threat = threatProjectile(f, ctx.projectiles);
    if (threat && !mem.queuedReaction) {
      let action = null;
      action = cfg.aiArchetype.onThreat?.(f, threat) || null;
      if (!action) {
        const r = Math.min(1, (f.reflex || 0.6) + panic * 0.3);
        const roll = Math.random();
        if (cfg.canDash !== false && f.cd.dash <= 0 && f.stamina >= 20 && roll < r * (panic ? 0.25 : 0.5)) action = 'dash';
        else if (cfg.canParry !== false && f.cd.parry <= 0 && roll < r * 0.5 + 0.25) action = 'parry';
        else if (cfg.canStartBlock?.(f) !== false && !threat.unblockable && (!humanized || panic > 0 || roll > r * 0.5 + 0.25)) action = 'escudo';
      }
      if (action && humanized) {
        const [min, max] = human.reaction;
        const actionNoise = (Math.random() - 0.5) * 0.04;
        const delay = min + Math.random() * (max - min);
        mem.queuedReaction = { action, timer: Math.max(min, Math.min(max, delay + actionNoise)) };
      } else if (action) {
        intent.actions.add(action);
        return intent;
      }
    }

    // Decision timing degrades with fatigue and panic; level 7 preserves the baseline.
    if (mem.decideTimer <= 0) {
      const fatigue = humanized && mem.combatTime > 30
        ? 1 + human.fatigue * Math.min(0.8, (mem.combatTime - 30) / 45)
        : 1;
      const decisionFactor = humanized ? human.decision * fatigue * (1 + panic * 0.8) : 1;
      mem.decideTimer = (0.15 + Math.random() * 0.2) * decisionFactor;

      const classAction = cfg.aiArchetype.chooseAction?.(f, opp, dist, Math.random(), {
        targetX, targetY, panic, humanized, threat, level
      });
      if (classAction) { intent.actions.add(classAction); return intent; }
      if (f.hp < f.maxHp * 0.35 && dist > 500 && Math.random() < 0.15) {
        intent.actions.add('meditar'); return intent;
      }
    }

    if (humanized && panic > 0 && Math.random() < panic * 0.15 && dist < 500 && !threat?.unblockable) {
      intent.actions.add('escudo');
    }

    // Carregar
    if (f.stamina < f.maxStamina * 0.4 && dist > 500 && Math.random() < 0.4) {
      intent.actions.add('charge');
    }

    // Ataque básico
    if (dist < cfg.stats.basicRange * 1.05) {
      intent.actions.add('ataque_basico');
      if (Math.random() < 0.3) intent.actions.add('ataque_secundario');
    }

    // Movimento
    const wanted = (style.desiredMin + style.desiredMax) / 2;
    let velocity;
    if (humanized && mem.misread && dist < 500 && !style.keepDistance) {
      velocity = Steering.flee(f, targetX, targetY, dt, f.maxSpeed * 0.75);
    } else if (style.keepDistance && dist < style.retreatRange) {
      velocity = Steering.flee(f, targetX, targetY, dt, f.maxSpeed * 0.8);
      intent.actions.add('ataque_secundario');
    } else if (dist > wanted * 1.2) {
      const desiredX = targetX - dx / (dist || 1) * wanted;
      const desiredY = targetY - dy / (dist || 1) * wanted;
      velocity = Steering.arrive(f, desiredX, desiredY, dt, f.maxSpeed, wanted);
    } else if (dist < wanted * 0.7) {
      velocity = Steering.flee(f, targetX, targetY, dt, f.maxSpeed * 0.75);
    } else {
      mem.strafeTimer -= dt;
      if (mem.strafeTimer <= 0) {
        mem.strafeTimer = 1.2 + Math.random() * 1.3;
        mem.strafeSign *= -1;
      }
      const targetX = f.x - dy / (dist || 1) * 260 * mem.strafeSign;
      const targetY = f.y + dx / (dist || 1) * 260 * mem.strafeSign;
      velocity = Steering.arrive(f, targetX, targetY, dt, f.maxSpeed * 0.65, 180);
      velocity = Steering.wander(f, velocity, dt, 65);
    }
    velocity = Steering.drag(velocity, dt);
    velocity = Steering.clamp(velocity, f.maxSpeed);
    intent.moveVx = velocity.x;
    intent.moveVy = velocity.y;
    const speed = Math.hypot(velocity.x, velocity.y);
    if (speed > 0) {
      intent.moveX = velocity.x / speed;
      intent.moveY = velocity.y / speed;
    }

    return intent;
  }

  return { decide, Steering, AI_LEVELS };
})();
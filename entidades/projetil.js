/* ============================================================
   projetil.js — Classe Projetil + tipos + update/draw
   Expõe window.Projectiles com classe Projetil + array global
   ============================================================ */
window.Projectiles = (() => {
  const { PROJ_TYPES } = window.BattleData;

  const list = [];

  class Projetil {
    constructor(opts) {
      this.owner = opts.owner;
      this.x = opts.x;
      this.y = opts.y;
      this.vx = opts.vx;
      this.vy = opts.vy;
      this.type = opts.type || 'pure_orb';
      const cfg = PROJ_TYPES[this.type] || PROJ_TYPES.pure_orb;

      this.hue = opts.hue !== undefined ? opts.hue : cfg.hue;
      this.radius = opts.radius !== undefined ? opts.radius : cfg.radius;
      this.life = opts.life !== undefined ? opts.life : cfg.life;

      this.damage = opts.damage || 8;
      this.stun = opts.stun || 0.1;
      this.status = opts.status || cfg.status || null;
      this.unblockable = opts.unblockable !== undefined ? opts.unblockable : !!cfg.unblockable;
      this.special = opts.special !== undefined ? opts.special : !!cfg.special;
      this.destructible = opts.destructible !== undefined
        ? opts.destructible
        : cfg.destructible !== undefined ? cfg.destructible : !this.special && !this.unblockable;
      this.piercing = !!opts.piercing;
      this.explosionRadius = opts.explosionRadius || 0;
      this.hitTargets = new Set();
      this.homing = opts.homing !== undefined ? opts.homing : (cfg.homing ? 3.0 : 0);

      this.trail = [];
      this.trailMax = cfg.trail ? Math.max(12, cfg.trail) : 8;
      this.dead = false;
      this.impact = false;
      this.trailLife = 0;
    }

    lingerAfterImpact() {
      this.impact = true;
      this.vx = 0;
      this.vy = 0;
      this.life = 0;
      this.trailLife = 0.3;
    }

    update(dt, target) {
      this.prevX = this.x;
      this.prevY = this.y;
      // Homing
      if (this.homing > 0 && target) {
        const dx = target.x - this.x, dy = target.y - this.y;
        const tA = Math.atan2(dy, dx), cA = Math.atan2(this.vy, this.vx);
        let diff = tA - cA;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        const steer = Math.sign(diff) * Math.min(Math.abs(diff), this.homing * 4 * dt);
        const nA = cA + steer;
        const speed = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(nA) * speed;
        this.vy = Math.sin(nA) * speed;
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.life -= dt;

      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.trailMax) this.trail.shift();
    }

    draw(ctx) {
      // Trail
      for (let j = 0; j < this.trail.length; j++) {
        const t = this.trail[j];
        const a = (j / this.trail.length) * (this.homing > 0 ? 0.75 : 0.55);
        ctx.beginPath();
        ctx.arc(t.x, t.y, this.radius * (j / this.trail.length) * 0.85, 0, 6.2832);
        ctx.fillStyle = `hsla(${this.hue},100%,70%,${a})`;
        ctx.fill();
      }

      if (this.type === 'slash') {
        const angle = Math.atan2(this.vy, this.vx);
        if (this.trail.length > 1) {
          const fade = this.impact ? this.trailLife / 0.3 : 0.3;
          ctx.beginPath();
          ctx.moveTo(this.trail[0].x, this.trail[0].y);
          for (let i = 1; i < this.trail.length; i++) ctx.lineTo(this.trail[i].x, this.trail[i].y);
          ctx.strokeStyle = `hsla(${this.hue},100%,88%,${fade})`;
          ctx.lineWidth = Math.max(2, this.radius * 0.18);
          ctx.shadowColor = `hsl(${this.hue},100%,80%)`;
          ctx.shadowBlur = 14 * fade;
          ctx.stroke();
        }
        if (this.impact) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        const gradient = ctx.createLinearGradient(-this.radius * 2.5, 0, this.radius * 2.5, 0);
        gradient.addColorStop(0, `hsla(${this.hue},100%,70%,0)`);
        gradient.addColorStop(0.45, `hsla(${this.hue},100%,95%,0.9)`);
        gradient.addColorStop(1, `hsla(${this.hue},100%,70%,0)`);
        ctx.strokeStyle = gradient;
        ctx.shadowColor = `hsl(${this.hue},100%,75%)`;
        ctx.shadowBlur = 18;
        ctx.lineWidth = Math.max(3, this.radius * 0.55);
        ctx.beginPath();
        ctx.moveTo(-this.radius * 2.5, 0);
        ctx.lineTo(this.radius * 2.5, 0);
        ctx.stroke();
        ctx.restore();
        return;
      }

      // Corpo
      const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 2);
      g.addColorStop(0, `hsla(${this.hue},100%,100%,1)`);
      g.addColorStop(0.4, `hsla(${this.hue},100%,75%,0.95)`);
      g.addColorStop(1, `hsla(${this.hue},100%,55%,0)`);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 2, 0, 6.2832);
      ctx.fillStyle = g;
      ctx.fill();

      // Anel extra para homing
      if (this.homing > 0) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * (1.5 + Math.sin(performance.now() * 0.012) * 0.12), 0, 6.2832);
        ctx.strokeStyle = `hsla(${this.hue},100%,90%,0.9)`;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + this.vx * 0.06, this.y + this.vy * 0.06);
        ctx.strokeStyle = `hsla(${this.hue},100%,95%,0.8)`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (this.reflect) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2.2, 0, 6.2832);
        ctx.strokeStyle = `hsla(${this.hue},100%,90%,0.9)`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }

  function spawn(opts) {
    const p = new Projetil(opts);
    list.push(p);
    return p;
  }

  function clear() { list.length = 0; }

  return { Projetil, spawn, clear, list };
})();
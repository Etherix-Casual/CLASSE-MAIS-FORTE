/* ============================================================
   recursos.js — Valores e regeneração de recursos de combate
   ============================================================ */
window.BattleResources = class BattleResources {
  constructor() {
    this.items = Object.create(null);
  }

  key(name) {
    return ({ hp: 'vida', health: 'vida', sp: 'stamina', mp: 'mana', ether: 'eter' })[name] || name;
  }

  define(definitions, scales = {}, preserveRatio = false) {
    for (const [key, definition] of Object.entries(definitions)) {
      const old = this.items[key];
      const maxScale = Number.isFinite(scales[key] && scales[key].max)
        ? scales[key].max / 100
        : 1;
      const regenScale = Number.isFinite(scales[key] && scales[key].regen)
        ? scales[key].regen / 100
        : 1;
      const max = Math.max(0, definition.max * maxScale);
      const ratio = old && old.max > 0 ? old.cur / old.max : 1;
      this.items[key] = {
        cur: old && preserveRatio ? Math.min(max, Math.max(0, ratio * max)) : max,
        max,
        regen: Math.max(0, definition.regen * regenScale)
      };
    }
  }

  current(key) { const item = this.items[this.key(key)]; return item ? item.cur : 0; }
  maximum(key) { const item = this.items[this.key(key)]; return item ? item.max : 0; }
  regeneration(key) { const item = this.items[this.key(key)]; return item ? item.regen : 0; }

  set(key, value) {
    const resource = this.items[this.key(key)];
    if (!resource) return;
    resource.cur = Math.min(resource.max, Math.max(0, Number(value) || 0));
  }

  restore(key, amount) {
    const resource = this.items[this.key(key)];
    if (!resource || amount <= 0) return;
    this.set(key, resource.cur + amount);
  }

  canPay(costs = {}) {
    return Object.entries(costs).every(([key, amount]) => this.current(key) >= amount);
  }

  spend(costs = {}) {
    if (!this.canPay(costs)) return false;
    for (const [key, amount] of Object.entries(costs)) this.set(this.key(key), this.current(key) - amount);
    return true;
  }

  fill() {
    for (const resource of Object.values(this.items)) resource.cur = resource.max;
  }

  regenerate(dt, { awakening = 1, meditation = {} } = {}) {
    for (const [key, resource] of Object.entries(this.items)) {
      const bonus = Number(meditation[key]) || 0;
      this.restore(key, (resource.regen * awakening + bonus) * dt);
    }
  }
};

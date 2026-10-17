(function () {
  const feixes = [];
  const efeito = {
    itens: feixes,
    criar(dados) {
      const feixe = {
        ...dados,
        life: dados.life === undefined ? 0.35 : dados.life,
        tick: dados.tick === undefined ? 0 : dados.tick
      };
      feixes.push(feixe);
      return feixe;
    },
    atualizar(dt, contexto) {
      const { blueF, redF } = contexto || {};
      for (let i = feixes.length - 1; i >= 0; i--) {
        const feixe = feixes[i];
        feixe.life -= dt;
        feixe.tick -= dt;
        feixe.x = feixe.owner.x;
        feixe.y = feixe.owner.y;
        const target = feixe.owner === blueF ? redF : blueF;
        if (target) {
          const dx = target.x - feixe.x;
          const dy = target.y - feixe.y;
          const along = dx * Math.cos(feixe.angle) + dy * Math.sin(feixe.angle);
          const across = Math.abs(-dx * Math.sin(feixe.angle) + dy * Math.cos(feixe.angle));
          if (along > 0 && along < feixe.length && across < feixe.width * 0.5 && feixe.tick <= 0 &&
              (!feixe.singleHit || !feixe.hit)) {
            feixe.owner.applyHit(target, feixe.damage, feixe.angle, feixe.knockback || 320, 0.12, feixe.status || null, true, !!feixe.unblockable, false, !!feixe.ignorarBarreira);
            feixe.tick = 0.22;
            if (feixe.singleHit) feixe.hit = true;
          }
        }
        if (feixe.life <= 0) feixes.splice(i, 1);
      }
    },
    desenhar(ctx) {
      for (const feixe of feixes) {
        ctx.save();
        ctx.translate(feixe.x, feixe.y);
        ctx.rotate(feixe.angle);
        const width = feixe.width * Math.min(1, feixe.life * 2);
        const gradient = ctx.createLinearGradient(0, -width, 0, width);
        gradient.addColorStop(0, `hsla(${feixe.hue},100%,65%,0)`);
        gradient.addColorStop(0.5, `hsla(${feixe.hue},100%,90%,0.85)`);
        gradient.addColorStop(1, `hsla(${feixe.hue},100%,65%,0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, -width, feixe.length, width * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, feixe.life)})`;
        ctx.fillRect(0, -width * 0.12, feixe.length, width * 0.24);
        ctx.restore();
      }
    },
    limpar() {
      feixes.length = 0;
    }
  };

  window.Registro.registrarEfeito('feixe', efeito);
})();

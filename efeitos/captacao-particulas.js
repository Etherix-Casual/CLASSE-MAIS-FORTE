(function () {
  const captacoes = [];
  const efeito = {
    itens: captacoes,
    criar(dados) {
      const particula = {
        x: dados.x,
        y: dados.y,
        hue: dados.hue,
        owner: dados.owner || null,
        vx: dados.vx || 0,
        vy: dados.vy || 0,
        radius: dados.radius === undefined ? 18 : dados.radius,
        intensidade: dados.intensidade === undefined ? 1 : dados.intensidade,
        vida: 1
      };
      captacoes.push(particula);
      return particula;
    },
    atualizar(dt) {
      for (let i = captacoes.length - 1; i >= 0; i--) {
        const item = captacoes[i];
        item.vida -= dt * 0.5;
        if (item.owner && item.owner.state === 'meditate') {
          const dx = item.owner.x - item.x, dy = item.owner.y - item.y;
          const distance = Math.hypot(dx, dy) || 1;
          item.vx += dx / distance * 420 * dt;
          item.vy += dy / distance * 420 * dt;
        }
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        item.vx *= Math.pow(0.2, dt);
        item.vy *= Math.pow(0.2, dt);
        if (item.vida <= 0 || (item.owner && item.owner.state !== 'meditate')) captacoes.splice(i, 1);
      }
    },
    desenhar(ctx) {
      if (!ctx) return;
      for (const item of captacoes) {
        const alpha = Math.max(0, item.vida);
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius + item.intensidade * 8, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${item.hue}, 100%, 70%, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    },
    limpar() {
      captacoes.length = 0;
    },
    estaAtivo() {
      return captacoes.length > 0;
    }
  };

  window.Registro.registrarEfeito('captacao-particulas', efeito);
})();

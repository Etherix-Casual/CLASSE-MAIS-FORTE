(function () {
  const particulas = [];
  const MAX_PARTICULAS = 3000;
  const efeito = {
    itens: particulas,
    criar(dados) {
      if (particulas.length >= MAX_PARTICULAS) return null;
      const particula = {
        x: dados.x,
        y: dados.y,
        vx: dados.vx,
        vy: dados.vy,
        hue: dados.hue,
        size: dados.size,
        life: 1,
        decay: dados.decay,
        light: dados.light
      };
      particulas.push(particula);
      return particula;
    },
    atualizar(dt) {
      for (let i = particulas.length - 1; i >= 0; i--) {
        const particula = particulas[i];
        particula.x += particula.vx * dt;
        particula.y += particula.vy * dt;
        particula.vx *= 0.93;
        particula.vy *= 0.93;
        particula.vy += 60 * dt;
        particula.life -= particula.decay * dt;
        if (particula.life <= 0) particulas.splice(i, 1);
      }
    },
    desenhar(ctx) {
      for (const particula of particulas) {
        const raio = particula.size * particula.life;
        if (raio < 0.4) continue;
        ctx.beginPath();
        ctx.arc(particula.x, particula.y, raio, 0, 6.2832);
        ctx.fillStyle = `hsl(${particula.hue},100%,${particula.light}%,${particula.life})`;
        ctx.fill();
      }
    },
    limpar() {
      particulas.length = 0;
    }
  };

  window.Registro.registrarEfeito('particula', efeito);
})();

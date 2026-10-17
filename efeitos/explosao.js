(function () {
  const explosoes = [];
  const ondas = [];
  const efeito = {
    explosoes,
    ondas,
    criar(dados) {
      const { x, y, hue } = dados;
      if (dados.explosao !== false) {
        const power = dados.power === undefined ? 1 : dados.power;
        const big = dados.big === undefined ? false : dados.big;
        explosoes.push({
          x, y, hue, power, life: 1,
          decay: big ? 1.7 : 3,
          maxR: (big ? 200 : 110) * power
        });

        if (typeof dados.spawnParticle === 'function') {
          const particleCount = Math.min(200, Math.floor((big ? 200 : 85) * power));
          for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * 6.2832;
            const speed = (0.3 + Math.random()) * (big ? 560 : 380);
            dados.spawnParticle(
              x,
              y,
              Math.cos(angle) * speed,
              Math.sin(angle) * speed,
              hue + (Math.random() - 0.5) * 60,
              2 + Math.random() * 4,
              1.8 + Math.random() * 1.3,
              80
            );
          }
        }
      }

      if (dados.onda !== false) {
        const onda = dados.onda || {};
        const power = dados.power === undefined ? 1 : dados.power;
        const big = dados.big === undefined ? false : dados.big;
        ondas.push({
          x, y, hue,
          r: onda.r === undefined ? 0 : onda.r,
          maxR: onda.maxR === undefined ? (big ? 420 : 200) * power : onda.maxR,
          speed: onda.speed === undefined ? (big ? 1100 : 750) : onda.speed,
          life: 1
        });
      }

      if (dados.shake !== false && window.BattleFX) {
        const power = dados.power === undefined ? 1 : dados.power;
        window.BattleFX.addShake(dados.big ? 70 : Math.min(60, 24 * power));
      }
    },
    atualizar(dt) {
      for (let i = explosoes.length - 1; i >= 0; i--) {
        explosoes[i].life -= explosoes[i].decay * dt;
        if (explosoes[i].life <= 0) explosoes.splice(i, 1);
      }
      for (let i = ondas.length - 1; i >= 0; i--) {
        const onda = ondas[i];
        onda.r += onda.speed * dt;
        onda.life = 1 - onda.r / onda.maxR;
        if (onda.r >= onda.maxR) ondas.splice(i, 1);
      }
    },
    desenhar(ctx) {
      for (const explosao of explosoes) {
        const progress = 1 - explosao.life;
        const radius = explosao.maxR * Math.sin(progress * Math.PI);
        if (progress < 0.6) {
          ctx.beginPath();
          ctx.arc(explosao.x, explosao.y, radius, 0, 6.2832);
          ctx.strokeStyle = `hsla(${explosao.hue},100%,85%,${(0.6 - progress) * 1.4})`;
          ctx.lineWidth = 4 * explosao.life + 1;
          ctx.stroke();
        }
        const coreRadius = radius * 0.65;
        if (coreRadius > 1) {
          const gradient = ctx.createRadialGradient(explosao.x, explosao.y, 0, explosao.x, explosao.y, coreRadius);
          gradient.addColorStop(0, `hsla(${explosao.hue},100%,100%,${explosao.life})`);
          gradient.addColorStop(0.35, `hsla(${explosao.hue},100%,80%,${explosao.life * 0.7})`);
          gradient.addColorStop(1, `hsla(${explosao.hue},100%,55%,0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(explosao.x, explosao.y, coreRadius, 0, 6.2832);
          ctx.fill();
        }
      }
      for (const onda of ondas) {
        ctx.beginPath();
        ctx.arc(onda.x, onda.y, onda.r, 0, 6.2832);
        ctx.strokeStyle = `hsla(${onda.hue},100%,85%,${onda.life * 0.8})`;
        ctx.lineWidth = 1 + onda.life * 6;
        ctx.stroke();
      }
    },
    limpar() {
      explosoes.length = 0;
      ondas.length = 0;
    }
  };

  window.Registro.registrarEfeito('explosao', efeito);
})();

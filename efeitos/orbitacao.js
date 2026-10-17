(function () {
  const orbitacoes = [];
  const efeito = {
    itens: orbitacoes,
    criar(dados) {
      const { x, y, hue } = dados;
      const orbitacao = {
        x, y, hue,
        radius: dados.radius === undefined ? 32 : dados.radius,
        speed: dados.speed === undefined ? 1 : dados.speed,
        count: dados.count === undefined ? 6 : dados.count,
          owner: dados.owner || null,
          t: 0
        };
        orbitacoes.push(orbitacao);
        return orbitacao;
    },
    atualizar(dt) {
        for (const orbitacao of orbitacoes) {
          orbitacao.t += dt * orbitacao.speed;
          if (orbitacao.owner) {
            orbitacao.x = orbitacao.owner.x;
            orbitacao.y = orbitacao.owner.y;
            orbitacao.hue = orbitacao.owner.classCfg.elementHues
              ? orbitacao.owner.classCfg.elementHues[orbitacao.owner.elementIndex % orbitacao.owner.classCfg.elementHues.length]
              : orbitacao.owner.hue;
          }
        }
    },
    desenhar(ctx) {
      if (!ctx) return;
      for (const orbitacao of orbitacoes) {
        for (let i = 0; i < orbitacao.count; i++) {
          const angulo = orbitacao.t + (i / orbitacao.count) * Math.PI * 2;
          const x = orbitacao.x + Math.cos(angulo) * orbitacao.radius;
          const y = orbitacao.y + Math.sin(angulo) * orbitacao.radius;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${orbitacao.hue}, 100%, 72%, 0.9)`;
          ctx.fill();
        }
      }
    },
    limpar() {
      orbitacoes.length = 0;
    },
    estaAtivo() {
      return orbitacoes.length > 0;
    }
  };

  window.Registro.registrarEfeito('orbitacao', efeito);
})();

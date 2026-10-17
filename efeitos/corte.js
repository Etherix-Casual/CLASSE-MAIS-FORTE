(function () {
  const cortes = [];
  const efeito = {
    itens: cortes,
    criar(dados) {
      if (dados.tipo === 'linha-descendo') {
        const corte = {
          ...dados,
          startY: dados.y,
          life: dados.life === undefined ? 0.35 : dados.life,
          width: dados.width === undefined ? 100 : dados.width
        };
        cortes.push(corte);
        return corte;
      }
      if (dados.tipo === 'quadrado') {
        const attack = { hit: false };
        const quadrados = Array.from({ length: 3 }, (_, index) => ({
          owner: dados.owner,
          target: dados.target,
          attack,
          tipo: 'quadrado',
          x: dados.x - Math.sin(dados.angle) * (index - 1) * 18,
          y: dados.y + Math.cos(dados.angle) * (index - 1) * 18,
          vx: Math.cos(dados.angle) * 1200,
          vy: Math.sin(dados.angle) * 1200,
          hue: dados.hue === undefined ? 180 : dados.hue,
          life: 0.15,
          windup: dados.windup || 0,
          size: 16 - index * 2,
          angle: dados.angle,
          damage: dados.damage,
          stun: dados.stun,
          knockback: dados.knockback,
          hit: false
        }));
        cortes.push(...quadrados);
        return quadrados;
      }
      if (dados.tipo === 'arco' || dados.arc !== undefined || dados.swingInicio !== undefined) {
        const arc = dados.arc === undefined ? Math.PI * 2 / 3 : dados.arc;
        const swing = dados.swing || 'horario';
        const direction = swing === 'anti-horario' ? -1 : 1;
        const startAngle = dados.swingInicio === undefined
          ? dados.angle - direction * arc * 0.5
          : dados.swingInicio;
        const endAngle = dados.swingFim === undefined
          ? dados.angle + direction * arc * 0.5
          : dados.swingFim;
        const duration = dados.duracao === undefined ? 0.1 : dados.duracao;
        const progress = dados.progress === undefined ? (dados.progresso || 0) : dados.progress;
        const corte = {
          ...dados,
          tipo: 'arco',
          arc,
          swing,
          swingInicio: startAngle,
          swingFim: endAngle,
          progress,
          progresso: progress,
          duracao: duration,
          autoSweep: dados.autoSweep !== false,
          fadeRemaining: dados.fade === undefined ? 0.1 : dados.fade,
          life: dados.life === undefined ? duration + 0.1 : dados.life,
          decay: dados.decay === undefined ? 1 : dados.decay,
          thickness: dados.thickness === undefined ? 14 : dados.thickness,
          lastProgress: -1,
          afterimages: []
        };
        cortes.push(corte);
        return corte;
      }
      const corte = {
        x: dados.x,
        y: dados.y,
        angle: dados.angle,
        length: dados.length,
        hue: dados.hue,
        life: dados.life === undefined ? 1 : dados.life,
        decay: dados.decay === undefined ? 4 : dados.decay,
        thickness: dados.thickness === undefined ? 10 : dados.thickness
      };
      cortes.push(corte);
      return corte;
    },
    atualizar(dt) {
      for (let i = cortes.length - 1; i >= 0; i--) {
        const corte = cortes[i];
        if (corte.tipo === 'linha-descendo') {
          corte.y = Math.min(corte.endY, corte.y + corte.speed * dt);
          corte.life -= dt;
          if (corte.y >= corte.endY || corte.life <= 0) cortes.splice(i, 1);
          continue;
        }
        if (corte.tipo === 'quadrado' || corte.tipo === 'arco') {
          if (corte.tipo === 'quadrado') {
            if (corte.windup > 0) {
              corte.windup -= dt;
              continue;
            }
            corte.x += corte.vx * dt;
            corte.y += corte.vy * dt;
            corte.life -= dt;
            if (!corte.attack.hit && corte.target && Math.hypot(corte.target.x - corte.x, corte.target.y - corte.y) <= (corte.target.bodyRadius || 40) + corte.size) {
              corte.owner.applyHit(corte.target, corte.damage, corte.angle, corte.knockback, corte.stun, null);
              corte.attack.hit = true;
            }
          } else {
            if (corte.owner) {
              corte.x = corte.owner.x;
              corte.y = corte.owner.y;
            }
            if (corte.autoSweep) {
              corte.progress = Math.min(1, corte.progress + dt / corte.duracao);
              corte.progresso = corte.progress;
            }
            if (corte.progress > corte.lastProgress) {
              const angle = corte.swingInicio + (corte.swingFim - corte.swingInicio) * corte.progress;
              corte.afterimages.push({ angle, life: 0.1 });
              corte.lastProgress = corte.progress;
            }
            for (const afterimage of corte.afterimages) afterimage.life -= dt;
            corte.afterimages = corte.afterimages.filter(afterimage => afterimage.life > 0).slice(-3);
            if (corte.progress >= 1) corte.fadeRemaining -= dt;
            corte.life -= dt * corte.decay;
          }
          if (corte.tipo === 'quadrado' && corte.life <= 0) cortes.splice(i, 1);
          else if (corte.tipo === 'arco' && corte.progress >= 1 && corte.fadeRemaining <= 0 && !corte.afterimages.length) cortes.splice(i, 1);
          continue;
        }
        corte.life -= corte.decay * dt;
        if (corte.life <= 0) cortes.splice(i, 1);
      }
    },
    desenhar(ctx) {
      for (const corte of cortes) {
        ctx.save();
        if (corte.tipo === 'linha-descendo') {
          const alpha = Math.max(0, corte.life / 0.35);
          const gradient = ctx.createLinearGradient(corte.x - corte.width / 2, 0, corte.x + corte.width / 2, 0);
          gradient.addColorStop(0, `hsla(${corte.hue},100%,70%,0)`);
          gradient.addColorStop(0.5, `hsla(${corte.hue},100%,95%,${alpha})`);
          gradient.addColorStop(1, `hsla(${corte.hue},100%,70%,0)`);
          ctx.beginPath();
          ctx.moveTo(corte.x, corte.startY);
          ctx.lineTo(corte.x, corte.y);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = corte.width;
          ctx.shadowColor = `hsl(${corte.hue},100%,75%)`;
          ctx.shadowBlur = 28;
          ctx.stroke();
          ctx.restore();
          continue;
        }
        if (corte.tipo === 'quadrado') {
          if (corte.windup > 0) {
            ctx.translate(corte.x, corte.y);
            ctx.rotate(corte.angle);
            ctx.strokeStyle = `hsla(${corte.hue},100%,80%,${Math.min(1, corte.windup / 0.04)})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(-5, -5, 10, 10);
            ctx.restore();
            continue;
          }
          const alpha = Math.max(0, corte.life / 0.15);
          const size = corte.size * alpha;
          ctx.translate(corte.x, corte.y);
          ctx.rotate(corte.angle);
          ctx.strokeStyle = `hsla(${corte.hue},100%,75%,${alpha})`;
          ctx.shadowColor = `hsl(${corte.hue},100%,65%)`;
          ctx.shadowBlur = 16;
          ctx.lineWidth = 3;
          ctx.strokeRect(-size / 2, -size / 2, size, size);
          ctx.restore();
          continue;
        }
        if (corte.tipo === 'arco') {
          const progress = Math.max(0, Math.min(1, corte.progress));
          const currentAngle = corte.swingInicio + (corte.swingFim - corte.swingInicio) * progress;
          const radius = corte.radius === undefined ? corte.length : corte.radius;
          const alpha = Math.min(1, Math.max(0, corte.fadeRemaining / 0.1));
          ctx.translate(corte.x, corte.y);
          ctx.rotate(corte.angle);
          const start = corte.swingInicio - corte.angle;
          const current = currentAngle - corte.angle;
          const x1 = Math.cos(start) * radius, y1 = Math.sin(start) * radius;
          const x2 = Math.cos(current) * radius, y2 = Math.sin(current) * radius;
          const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
          gradient.addColorStop(0, `hsla(${corte.hue},100%,80%,0)`);
          gradient.addColorStop(0.72, `hsla(${corte.hue},100%,88%,${alpha * 0.55})`);
          gradient.addColorStop(1, `hsla(${corte.hue},100%,98%,${alpha})`);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = corte.thickness || 14;
          ctx.lineCap = 'round';
          ctx.shadowColor = `hsl(${corte.hue},100%,75%)`;
          ctx.shadowBlur = corte.big ? 32 : 20;
          if (progress > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, radius, start, current, corte.swing === 'anti-horario');
            ctx.stroke();
          }
          for (const afterimage of corte.afterimages) {
            ctx.save();
            ctx.rotate(afterimage.angle - corte.angle);
            ctx.globalAlpha = alpha * (afterimage.life / 0.1) * 0.5;
            ctx.beginPath();
            ctx.moveTo(radius - 20, 0);
            ctx.lineTo(radius + 12, 0);
            ctx.stroke();
            ctx.restore();
          }
          ctx.save();
          ctx.rotate(current);
          ctx.beginPath();
          ctx.moveTo(radius - 20, 0);
          ctx.lineTo(radius + 12, 0);
          ctx.strokeStyle = `hsla(${corte.hue},100%,98%,${alpha})`;
          ctx.lineWidth = Math.max(3, (corte.thickness || 14) * 0.4);
          ctx.shadowBlur = 24;
          ctx.stroke();
          ctx.restore();
          ctx.restore();
          continue;
        }
        ctx.translate(corte.x, corte.y);
        ctx.rotate(corte.angle);
        const alpha = corte.life;
        const length = corte.length * (1 - corte.life * 0.5);
        const gradient = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
        gradient.addColorStop(0, `hsla(${corte.hue},100%,70%,0)`);
        gradient.addColorStop(0.5, `hsla(${corte.hue},100%,95%,${alpha})`);
        gradient.addColorStop(1, `hsla(${corte.hue},100%,70%,0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(0, 0, length / 2, (corte.thickness || 10) * alpha, 0, 0, 6.2832);
        ctx.fill();
        ctx.restore();
      }
    },
    limpar() {
      cortes.length = 0;
    }
  };

  window.Registro.registrarEfeito('corte', efeito);
})();

(function () {
  const arcos = [];
  const efeito = {
    itens: arcos,
    criar(dados) {
      const arco = {
        ...dados,
        previousRadius: dados.previousRadius || 0,
        hit: dados.hit || false,
        dead: false
      };
      arcos.push(arco);
      return arco;
    },
    atualizar(dt) {
      for (let i = arcos.length - 1; i >= 0; i--) {
        const arco = arcos[i];
        arco.previousRadius = arco.radius;
        arco.radius = Math.min(arco.maxRadius, arco.radius + arco.speed * dt);
        const target = arco.target;
        if (target && !arco.hit) {
          const dx = target.x - arco.x;
          const dy = target.y - arco.y;
          const distance = Math.hypot(dx, dy);
          let angle = Math.atan2(dy, dx) - arco.angle;
          while (angle > Math.PI) angle -= Math.PI * 2;
          while (angle < -Math.PI) angle += Math.PI * 2;
          if (distance + 40 >= arco.previousRadius &&
              distance - 40 <= arco.radius &&
              Math.abs(angle) <= arco.halfAngle) {
            arco.owner.applyHit(target, arco.damage, arco.angle, 1000, 1, 'bleeding', true);
            arco.hit = true;
          }
        }
        if (arco.radius >= arco.maxRadius) {
          arco.dead = true;
          arcos.splice(i, 1);
        }
      }
    },
    desenhar(ctx) {
      for (const arco of arcos) {
        const alpha = Math.max(0, 1 - arco.radius / arco.maxRadius);
        ctx.save();
        ctx.beginPath();
        ctx.arc(arco.x, arco.y, arco.radius, arco.angle - arco.halfAngle, arco.angle + arco.halfAngle);
        ctx.strokeStyle = `hsla(${arco.hue},100%,75%,${0.45 + alpha * 0.5})`;
        ctx.lineWidth = 42 * alpha + 8;
        ctx.shadowColor = `hsla(${arco.hue},100%,70%,0.9)`;
        ctx.shadowBlur = 28;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(arco.x, arco.y, arco.radius, arco.angle - arco.halfAngle, arco.angle + arco.halfAngle);
        ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.9})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }
    },
    limpar() {
      arcos.length = 0;
    }
  };

  window.Registro.registrarEfeito('arco', efeito);
})();

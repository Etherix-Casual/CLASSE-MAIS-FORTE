(function () {
  const vortices = [];
  const efeito = {
    itens: vortices,
    criar(dados) {
      const vortice = { ...dados, tick: dados.tick || 0 };
      vortices.push(vortice);
      return vortice;
    },
    atualizar(dt, contexto) {
      contexto = contexto || {};
      const { blueF, redF, Projectiles } = contexto;
      for (let i = vortices.length - 1; i >= 0; i--) {
        const vortice = vortices[i];
        vortice.x += vortice.vx * dt;
        vortice.y += vortice.vy * dt;
        vortice.vx *= Math.pow(0.7, dt);
        vortice.vy *= Math.pow(0.7, dt);
        vortice.life -= dt;
        const target = vortice.owner === blueF ? redF : blueF;
        if (target) {
          const dx = vortice.x - target.x;
          const dy = vortice.y - target.y;
          const distance = Math.hypot(dx, dy);
          if (distance < vortice.influenceR && distance > 1) {
            const strength = (vortice.influenceR - distance) / vortice.influenceR;
            target.vx += dx / distance * vortice.pullForce * strength * strength * dt;
            target.vy += dy / distance * vortice.pullForce * strength * strength * dt;
            vortice.tick = (vortice.tick || 0) - dt;
            if (vortice.tick <= 0) {
              vortice.owner.applyHit(target, vortice.damage, Math.atan2(dy, dx), 35, 0, vortice.status || null, true, !!vortice.unblockable);
              vortice.tick = 0.35;
            }
          }
        }
        if (Projectiles) {
          for (let p = Projectiles.list.length - 1; p >= 0; p--) {
            const projectile = Projectiles.list[p];
            if (projectile.type === 'shadow' || (projectile.type === 'blackhole' && projectile.owner === vortice.owner)) continue;
            const distance = Math.hypot(projectile.x - vortice.x, projectile.y - vortice.y);
            if (distance < vortice.influenceR && distance > 1) {
              projectile.vx += (vortice.x - projectile.x) / distance * 900 * dt;
              projectile.vy += (vortice.y - projectile.y) / distance * 900 * dt;
              if (distance < vortice.radius * 0.8) {
                window.Registro.obterEfeito('explosao').criar({
                  x: projectile.x, y: projectile.y, hue: vortice.hue || 280,
                  power: 0.4, big: false, spawnParticle: contexto.spawnParticle
                });
                Projectiles.list.splice(p, 1);
              }
            }
          }
        }
        if (vortice.life <= 0) {
          window.Registro.obterEfeito('explosao').criar({
            x: vortice.x, y: vortice.y, hue: 280,
            power: 4, big: true, spawnParticle: contexto.spawnParticle
          });
          vortices.splice(i, 1);
        }
      }
    },
    desenhar(ctx, contexto) {
      const time = contexto && contexto.state ? contexto.state.time : 0;
      for (const vortice of vortices) {
        const alpha = 0.22 + Math.sin(time * 4) * 0.05;
        const gradient = ctx.createRadialGradient(vortice.x, vortice.y, vortice.radius, vortice.x, vortice.y, vortice.influenceR);
        gradient.addColorStop(0, `rgba(150,0,255,${alpha})`);
        gradient.addColorStop(0.55, `rgba(90,0,180,${alpha * 0.5})`);
        gradient.addColorStop(1, 'rgba(50,0,100,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(vortice.x, vortice.y, vortice.influenceR, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.arc(vortice.x, vortice.y, vortice.radius + 24 + i * 25 + Math.sin(time * 5 + i) * 7, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(205,125,255,${0.75 - i * 0.1})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(vortice.x, vortice.y, vortice.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
      }
    },
    limpar() {
      vortices.length = 0;
    },
    buscarDono(dono) {
      return vortices.find(vortice => vortice.owner === dono);
    }
  };

  window.Registro.registrarEfeito('vortice', efeito);
})();

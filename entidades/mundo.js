window.createBattleWorld = function (scope) {
  with (scope) {
  function drawWorld() {
    const hue = config.mundo.cor;
    const palette = {
      espaco: `hsl(${hue} 45% 4%)`,
      ceu: `hsl(${hue} 45% 14%)`,
      grid: `hsl(${hue} 45% 6%)`,
      vazio: `hsl(${hue} 20% 3%)`
    };
    ctx.fillStyle = palette[config.mundo.cenario];
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);

    if (config.mundo.cenario === 'grid') {
      ctx.beginPath();
      for (let x = 0; x <= WORLD.w; x += 120) {
        ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.h);
      }
      for (let y = 0; y <= WORLD.h; y += 120) {
        ctx.moveTo(0, y); ctx.lineTo(WORLD.w, y);
      }
      ctx.strokeStyle = `hsla(${hue},70%,65%,0.12)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const starCount = config.mundo.cenario === 'vazio'
      ? 0
      : Math.round(config.mundo.estrelas * WORLD_STARS.length / 200);
    for (let i = 0; i < starCount; i++) {
      const star = WORLD_STARS[i];
      ctx.beginPath();
      ctx.arc(star.x / 3200 * WORLD.w, star.y / 1800 * WORLD.h, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue + 35},80%,88%,${star.alpha})`;
      ctx.fill();
    }

    if (config.mundo.borda) {
      ctx.strokeStyle = `hsla(${hue + 35},85%,70%,0.65)`;
      ctx.lineWidth = 4;
      ctx.setLineDash([20, 20]);
      ctx.strokeRect(0, 0, WORLD.w, WORLD.h);
      ctx.setLineDash([]);
    }
  }

  function updateCamera(dt) {
    const focus = camera.focusEnabled ? BattleFX.getFocus() : null;
    const midX = focus ? focus.x : (blueF.x + redF.x) / 2;
    const midY = focus ? focus.y : (blueF.y + redF.y) / 2;
    const dist = Math.hypot(blueF.x - redF.x, blueF.y - redF.y);
    let targetZoom = Math.min(W / (dist + (focus ? 480 : 700)), H / (dist + (focus ? 380 : 500)));
    targetZoom = focus
      ? Math.max(0.78, Math.min(1.08, targetZoom))
      : Math.max(0.35, Math.min(1.5, targetZoom * camera.zoomMul));
    const tracking = Math.max(1, Math.min(5, camera.tracking));
    camera.x += (midX - camera.x) * tracking * dt;
    camera.y += (midY - camera.y) * tracking * dt;
    camera.zoom += (targetZoom - camera.zoom) * tracking * 0.75 * dt;
    const shake = BattleFX.getShake();
    if (shake > 0.5) {
      camera.shakeX = (Math.random() - 0.5) * shake / camera.zoom;
      camera.shakeY = (Math.random() - 0.5) * shake / camera.zoom;
    } else { camera.shakeX = 0; camera.shakeY = 0; }
  }

    return { drawWorld, updateCamera };
  }
};

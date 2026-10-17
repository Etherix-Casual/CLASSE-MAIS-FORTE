window.createBattleRender = function (scope) {
  with (scope) {
    function drawProjectiles() {
      for (const projectile of Projectiles.list) projectile.draw(ctx);
    }

    function drawDebugOverlay() {
      if (!debug.showHitboxes) return;
      ctx.save();
      ctx.setLineDash([6, 5]);
      for (const fighter of [blueF, redF]) {
        ctx.beginPath();
        ctx.arc(fighter.x, fighter.y, fighter.bodyRadius || 40, 0, 6.2832);
        ctx.strokeStyle = fighter.side < 0 ? '#6cf' : '#f88';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(fighter.x, fighter.y, 420, 0, 6.2832);
        ctx.strokeStyle = 'rgba(180,180,200,0.22)';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (fighter.state === 'strike') {
          ctx.beginPath();
          ctx.moveTo(fighter.x, fighter.y);
          ctx.lineTo(
            fighter.x + Math.cos(fighter.strikeAngle) * fighter.strikeRange,
            fighter.y + Math.sin(fighter.strikeAngle) * fighter.strikeRange
          );
          ctx.strokeStyle = '#ffe66d';
          ctx.lineWidth = 4;
          ctx.stroke();
        }
      }
      for (const projectile of Projectiles.list) {
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, projectile.radius, 0, 6.2832);
        ctx.strokeStyle = projectile.owner.side < 0 ? '#8ff' : '#faa';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    return { drawProjectiles, drawDebugOverlay };
  }
};

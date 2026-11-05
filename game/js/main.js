'use strict';
// =====================================================================
//  Start und Hauptschleife
// =====================================================================

function setSpeed(s) { Game.speed = s; Game.paused = false; Game.autoPaused = false; }
function togglePause() { Game.paused = !Game.paused; Game.autoPaused = false; }

(function start() {
  UI.init();
  MapView.init();
  if (load()) {
    MapView.showCompany();
    UI.renderPanel();
    notify(`Spielstand geladen: ${city().name}, ${fmtDay(Game.S.time)}, ${fmtClock(Game.S.time)}.`, 'info');
    if (Game.S.gameOver) UI.gameOver();
  } else {
    UI.startSetup();
  }

  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(250, now - last);
    last = now;
    if (Game.S && !Game.paused && !Game.S.gameOver) {
      acc += dt * Game.speed;
      let steps = 0;
      while (acc >= 1000 && steps < 120) { acc -= 1000; step(); steps++; }
    }
    Game.frac = acc / 1000;
    UI.frame(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.addEventListener('beforeunload', () => { if (Game.S) save(); });
})();

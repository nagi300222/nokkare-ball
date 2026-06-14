(() => {
  'use strict';

  const VERSION = 'v0.1.0-local-mobile';
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const timeLabel = document.getElementById('timeLabel');
  const p1State = document.getElementById('p1State');
  const p2State = document.getElementById('p2State');
  const message = document.getElementById('message');
  const startButton = document.getElementById('startButton');
  const resetButton = document.getElementById('resetButton');

  const world = {
    w: 1000,
    h: 1000,
    cx: 500,
    cy: 500,
    arenaRadius: 405,
    running: false,
    ended: false,
    timer: 60,
    lastTs: 0,
    shake: 0,
  };

  const tuning = {
    accel: 980,
    friction: 0.988,
    maxSpeed: 485,
    playerRadius: 58,
    collisionSpring: 0.88,
    collisionKick: 0.56,
    wallWarning: 0.9,
  };

  const players = [
    makePlayer('RED', '#ff4d5a', 365, 500, 1),
    makePlayer('BLUE', '#4bb4ff', 635, 500, -1),
  ];

  const inputs = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];

  const keys = new Set();

  function makePlayer(name, color, x, y, face) {
    return {
      name,
      color,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: tuning.playerRadius,
      alive: true,
      face,
      squash: 0,
      score: 0,
    };
  }

  function resetGame({ start = false } = {}) {
    Object.assign(players[0], makePlayer('RED', '#ff4d5a', 365, 500, 1));
    Object.assign(players[1], makePlayer('BLUE', '#4bb4ff', 635, 500, -1));
    world.running = start;
    world.ended = false;
    world.timer = 60;
    world.lastTs = performance.now();
    world.shake = 0;
    message.classList.toggle('hidden', start);
    if (!start) {
      message.querySelector('h2').textContent = 'のっかれ！';
      message.querySelector('p').textContent = '左右のスティックを倒して、相手を場外へ押し出せ！';
      startButton.textContent = 'スタート';
    }
    updateHud();
  }

  function startGame() {
    resetGame({ start: true });
  }

  function endGame(title, detail) {
    world.running = false;
    world.ended = true;
    message.querySelector('h2').textContent = title;
    message.querySelector('p').textContent = detail;
    startButton.textContent = 'もう一回';
    message.classList.remove('hidden');
    updateHud();
  }

  function updateHud() {
    timeLabel.textContent = Math.max(0, Math.ceil(world.timer));
    p1State.textContent = players[0].alive ? 'IN' : 'OUT';
    p2State.textContent = players[1].alive ? 'IN' : 'OUT';
  }

  function keyboardInput() {
    const k1 = vectorFromKeys('KeyA', 'KeyD', 'KeyW', 'KeyS');
    const k2 = vectorFromKeys('ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown');

    // キーボード操作はジョイスティック入力に上乗せ。スマホとPCの両方で遊べる。
    if (k1.active) inputs[0] = { x: k1.x, y: k1.y };
    if (k2.active) inputs[1] = { x: k2.x, y: k2.y };
  }

  function vectorFromKeys(left, right, up, down) {
    let x = 0;
    let y = 0;
    if (keys.has(left)) x -= 1;
    if (keys.has(right)) x += 1;
    if (keys.has(up)) y -= 1;
    if (keys.has(down)) y += 1;
    const len = Math.hypot(x, y);
    if (len > 0) return { x: x / len, y: y / len, active: true };
    return { x: 0, y: 0, active: false };
  }

  function step(dt) {
    if (!world.running) return;
    keyboardInput();

    world.timer -= dt;
    if (world.timer <= 0) {
      const d0 = distFromCenter(players[0]);
      const d1 = distFromCenter(players[1]);
      if (Math.abs(d0 - d1) < 4) endGame('DRAW!', '時間切れ。ほぼ同じ位置で粘り切った！');
      else if (d0 < d1) endGame('RED WIN!', '時間切れ。中央に近かったREDの勝ち！');
      else endGame('BLUE WIN!', '時間切れ。中央に近かったBLUEの勝ち！');
      return;
    }

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.alive) continue;
      const input = inputs[i];
      p.vx += input.x * tuning.accel * dt;
      p.vy += input.y * tuning.accel * dt;

      const speed = Math.hypot(p.vx, p.vy);
      if (speed > tuning.maxSpeed) {
        p.vx = (p.vx / speed) * tuning.maxSpeed;
        p.vy = (p.vy / speed) * tuning.maxSpeed;
      }

      p.vx *= Math.pow(tuning.friction, dt * 60);
      p.vy *= Math.pow(tuning.friction, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.squash = Math.max(0, p.squash - dt * 7);
    }

    resolveCollision(players[0], players[1]);
    checkFalls();
    updateHud();
  }

  function resolveCollision(a, b) {
    if (!a.alive || !b.alive) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let dist = Math.hypot(dx, dy);
    const minDist = a.radius + b.radius;
    if (dist <= 0.001) dist = 0.001;
    if (dist >= minDist) return;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    const push = overlap * 0.5 * tuning.collisionSpring;

    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;

    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const rel = rvx * nx + rvy * ny;
    const impact = Math.max(80, Math.abs(rel));
    const impulse = (impact * tuning.collisionKick) / 2;

    a.vx -= nx * impulse;
    a.vy -= ny * impulse;
    b.vx += nx * impulse;
    b.vy += ny * impulse;
    a.squash = b.squash = Math.min(1, impact / 520);
    world.shake = Math.min(12, world.shake + impact / 55);
  }

  function checkFalls() {
    for (const p of players) {
      if (!p.alive) continue;
      const d = distFromCenter(p);
      if (d > world.arenaRadius + p.radius * 0.55) {
        p.alive = false;
        p.vx *= 0.35;
        p.vy *= 0.35;
      }
    }

    const alive = players.filter(p => p.alive);
    if (alive.length === 1) {
      endGame(`${alive[0].name} WIN!`, `${alive[0].name}が場外に押し出した！`);
    } else if (alive.length === 0) {
      endGame('DRAW!', '同時落下！これはこれで一番マリパしてる。');
    }
  }

  function distFromCenter(p) {
    return Math.hypot(p.x - world.cx, p.y - world.cy);
  }

  function draw() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    const desiredW = Math.floor(rect.width * dpr);
    const desiredH = Math.floor(rect.height * dpr);
    if (canvas.width !== desiredW || canvas.height !== desiredH) {
      canvas.width = desiredW;
      canvas.height = desiredH;
    }

    ctx.save();
    ctx.setTransform(canvas.width / world.w, 0, 0, canvas.height / world.h, 0, 0);
    ctx.clearRect(0, 0, world.w, world.h);

    if (world.shake > 0.2) {
      const sx = (Math.random() - 0.5) * world.shake;
      const sy = (Math.random() - 0.5) * world.shake;
      ctx.translate(sx, sy);
      world.shake *= 0.86;
    }

    drawBackground();
    drawArena();
    drawPlayers();
    drawVersion();
    ctx.restore();
  }

  function drawBackground() {
    const grad = ctx.createRadialGradient(500, 500, 60, 500, 500, 700);
    grad.addColorStop(0, '#232744');
    grad.addColorStop(1, '#101225');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, world.w, world.h);

    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let x = 80; x < world.w; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, world.h);
      ctx.stroke();
    }
    for (let y = 80; y < world.h; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(world.w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawArena() {
    const { cx, cy, arenaRadius } = world;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.42)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#d9c785';
    ctx.fill();
    ctx.restore();

    const floorGrad = ctx.createRadialGradient(cx - 120, cy - 150, 60, cx, cy, arenaRadius);
    floorGrad.addColorStop(0, '#fff3b7');
    floorGrad.addColorStop(0.55, '#dbc068');
    floorGrad.addColorStop(1, '#9f7137');
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius, 0, Math.PI * 2);
    ctx.fillStyle = floorGrad;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 12;
    for (let r = 110; r < arenaRadius; r += 110) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * arenaRadius, cy + Math.sin(a) * arenaRadius);
      ctx.stroke();
    }
    ctx.restore();

    ctx.lineWidth = 18;
    ctx.strokeStyle = '#613c22';
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius - 18, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawPlayers() {
    const ordered = [...players].sort((a, b) => a.y - b.y);
    for (const p of ordered) drawPlayer(p);
  }

  function drawPlayer(p) {
    const speed = Math.hypot(p.vx, p.vy);
    const angle = speed > 16 ? Math.atan2(p.vy, p.vx) : p.face > 0 ? 0 : Math.PI;
    const squash = p.squash;
    const aliveAlpha = p.alive ? 1 : 0.32;

    ctx.save();
    ctx.globalAlpha = aliveAlpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);

    // shadow
    ctx.save();
    ctx.globalAlpha *= 0.28;
    ctx.scale(1.15, 0.42);
    ctx.beginPath();
    ctx.arc(0, p.radius * 1.15, p.radius * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    // ball
    ctx.save();
    ctx.scale(1 + squash * 0.16, 1 - squash * 0.11);
    const ballGrad = ctx.createRadialGradient(-22, -26, 8, 0, 0, p.radius);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.2, p.color);
    ballGrad.addColorStop(1, '#1d2144');
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,.62)';
    ctx.stroke();

    ctx.globalAlpha *= 0.22;
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffffff';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(0, i * 18, p.radius * 0.72, p.radius * 0.26, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // rider
    ctx.rotate(-angle);
    ctx.translate(0, -p.radius - 28);
    ctx.beginPath();
    ctx.roundRect(-23, 8, 46, 42, 16);
    ctx.fillStyle = '#f3dfc8';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = p.color;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe0bd';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#172033';
    ctx.beginPath();
    ctx.arc(-8, -3, 3.6, 0, Math.PI * 2);
    ctx.arc(8, -3, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#172033';
    ctx.beginPath();
    ctx.arc(0, 6, 9, 0.15, Math.PI - 0.15);
    ctx.stroke();

    ctx.font = '800 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,.45)';
    ctx.lineWidth = 6;
    ctx.strokeText(p.name, 0, p.radius + 98);
    ctx.fillText(p.name, 0, p.radius + 98);

    ctx.restore();

    // Danger ring when close to edge
    const edgeRatio = distFromCenter(p) / world.arenaRadius;
    if (p.alive && edgeRatio > tuning.wallWarning) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.8, (edgeRatio - tuning.wallWarning) * 5);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawVersion() {
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,.48)';
    ctx.fillText(VERSION, 24, 974);
  }

  function loop(ts) {
    const dt = Math.min(0.033, Math.max(0, (ts - world.lastTs) / 1000 || 0));
    world.lastTs = ts;
    step(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function setupJoystick(el, index) {
    const stick = el.querySelector('.stick');
    const state = { pointerId: null };

    function setStick(clientX, clientY) {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const max = rect.width * 0.32;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const len = Math.hypot(dx, dy);
      const clamped = Math.min(max, len);
      if (len > 0) {
        dx = (dx / len) * clamped;
        dy = (dy / len) * clamped;
      }
      inputs[index] = { x: dx / max, y: dy / max };
      stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    function resetStick() {
      inputs[index] = { x: 0, y: 0 };
      stick.style.transform = 'translate(-50%, -50%)';
      state.pointerId = null;
    }

    el.addEventListener('pointerdown', (ev) => {
      state.pointerId = ev.pointerId;
      el.setPointerCapture(ev.pointerId);
      setStick(ev.clientX, ev.clientY);
    });
    el.addEventListener('pointermove', (ev) => {
      if (state.pointerId !== ev.pointerId) return;
      setStick(ev.clientX, ev.clientY);
    });
    el.addEventListener('pointerup', resetStick);
    el.addEventListener('pointercancel', resetStick);
  }

  startButton.addEventListener('click', startGame);
  resetButton.addEventListener('click', () => resetGame({ start: false }));
  window.addEventListener('keydown', ev => {
    keys.add(ev.code);
    if (ev.code === 'Space' && !world.running) startGame();
  });
  window.addEventListener('keyup', ev => keys.delete(ev.code));
  window.addEventListener('blur', () => keys.clear());

  setupJoystick(document.getElementById('joy1'), 0);
  setupJoystick(document.getElementById('joy2'), 1);
  resetGame({ start: false });
  requestAnimationFrame(loop);
})();

(() => {
  'use strict';

  const VERSION = 'v0.2.2-impulse-bounce-vector-brake';
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const timeLabel = document.getElementById('timeLabel');
  const p1State = document.getElementById('p1State');
  const p2State = document.getElementById('p2State');
  const message = document.getElementById('message');
  const startButton = document.getElementById('startButton');
  const resetButton = document.getElementById('resetButton');
  const timeSelect = document.getElementById('timeSelect');
  const stockSelect = document.getElementById('stockSelect');

  const settings = {
    timeLimit: 60,
    stocks: 1,
  };

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
    // v0.2.2: 操作感はv0.2.1を維持。衝突は円同士のインパルス計算で強めに弾く。
    accel: 760,
    activeFriction: 0.956,
    idleFriction: 0.895,
    reverseBrakeFriction: 0.84,
    maxSpeed: 365,
    postCollisionMaxSpeed: 430,
    playerRadius: 58,
    positionCorrection: 0.74,
    restitution: 0.82,
    minBounceImpulse: 58,
    separatingNudge: 36,
    tangentDamping: 0.1,
    minImpact: 44,
    vectorBrakeDuration: 0.82,
    vectorBrakeThreshold: 0.22,
    vectorBrakeAccel: 1120,
    vectorBrakeDrag: 3.2,
    fallForgiveness: 0.72,
    respawnTime: 1.0,
    invulnTime: 1.05,
    wallWarning: 0.9,
    deadZone: 0.06,
  };

  let players = [];

  const stickInputs = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  const keyInputs = [
    { x: 0, y: 0, active: false },
    { x: 0, y: 0, active: false },
  ];

  const keys = new Set();

  function makePlayer(name, color, spawnX, spawnY, face) {
    return {
      name,
      color,
      spawnX,
      spawnY,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      radius: tuning.playerRadius,
      alive: true,
      face,
      squash: 0,
      stocks: settings.stocks,
      respawnTimer: 0,
      invuln: 0,
      hitX: 0,
      hitY: 0,
      hitTimer: 0,
      hitPower: 0,
    };
  }

  function readSettings() {
    settings.timeLimit = timeSelect.value === 'inf' ? Infinity : Number(timeSelect.value || 60);
    settings.stocks = Math.max(1, Number(stockSelect.value || 1));
  }

  function createPlayers() {
    players = [
      makePlayer('RED', '#ff4d5a', 500, 355, 1),
      makePlayer('BLUE', '#4bb4ff', 500, 645, -1),
    ];
  }

  function resetGame({ start = false } = {}) {
    readSettings();
    clearAllInput();
    createPlayers();
    world.running = start;
    world.ended = false;
    world.timer = settings.timeLimit;
    world.lastTs = performance.now();
    world.shake = 0;
    setSettingsLocked(start);
    message.classList.toggle('hidden', start);
    if (!start) {
      message.querySelector('h2').textContent = 'のっかれ！';
      message.querySelector('p').textContent = ruleText();
      startButton.textContent = 'スタート';
    }
    updateHud();
  }

  function ruleText() {
    const timeText = settings.timeLimit === Infinity ? '時間∞' : `${settings.timeLimit}秒`;
    return `${timeText} / ストック${settings.stocks}。上下のスティックで相手を弾き出せ！`;
  }

  function startGame() {
    resetGame({ start: true });
  }

  function endGame(title, detail) {
    world.running = false;
    world.ended = true;
    for (const p of players) stopPlayer(p);
    clearAllInput();
    setSettingsLocked(false);
    message.querySelector('h2').textContent = title;
    message.querySelector('p').textContent = detail;
    startButton.textContent = 'もう一回';
    message.classList.remove('hidden');
    updateHud();
  }

  function setSettingsLocked(locked) {
    timeSelect.disabled = locked;
    stockSelect.disabled = locked;
  }

  function stopPlayer(p) {
    p.vx = 0;
    p.vy = 0;
    p.squash = 0;
    clearHitVector(p);
  }

  function clearHitVector(p) {
    p.hitX = 0;
    p.hitY = 0;
    p.hitTimer = 0;
    p.hitPower = 0;
  }

  function clearAllInput() {
    keys.clear();
    for (let i = 0; i < 2; i++) {
      stickInputs[i] = { x: 0, y: 0 };
      keyInputs[i] = { x: 0, y: 0, active: false };
    }
    document.querySelectorAll('.stick').forEach(stick => {
      stick.style.transform = 'translate(-50%, -50%)';
    });
  }

  function updateHud() {
    timeLabel.textContent = settings.timeLimit === Infinity ? '∞' : Math.max(0, Math.ceil(world.timer));
    p1State.textContent = playerStateText(players[0]);
    p2State.textContent = playerStateText(players[1]);
  }

  function playerStateText(p) {
    if (!p) return 'READY';
    if (p.alive) return `♥${p.stocks}`;
    if (p.stocks > 0) return `↻${p.stocks}`;
    return 'OUT';
  }

  function keyboardInput() {
    keyInputs[0] = vectorFromKeys('KeyA', 'KeyD', 'KeyW', 'KeyS');
    keyInputs[1] = vectorFromKeys('ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown');
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

  function getInput(index) {
    const key = keyInputs[index];
    if (key.active) return { x: key.x, y: key.y };
    return stickInputs[index];
  }

  function step(dt) {
    if (!world.running) return;
    keyboardInput();

    if (settings.timeLimit !== Infinity) {
      world.timer -= dt;
      if (world.timer <= 0) {
        finishByTime();
        return;
      }
    }

    updateRespawns(dt);

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.alive) continue;

      p.invuln = Math.max(0, p.invuln - dt);
      const rawInput = getInput(i);
      const inputPower = Math.hypot(rawInput.x, rawInput.y);
      const input = inputPower < tuning.deadZone ? { x: 0, y: 0 } : rawInput;

      p.vx += input.x * tuning.accel * dt;
      p.vy += input.y * tuning.accel * dt;

      limitSpeed(p, tuning.maxSpeed);

      const currentSpeed = Math.hypot(p.vx, p.vy);
      let friction = inputPower < tuning.deadZone ? tuning.idleFriction : tuning.activeFriction;
      if (currentSpeed > 8 && inputPower >= tuning.deadZone) {
        const dot = (p.vx / currentSpeed) * input.x + (p.vy / currentSpeed) * input.y;
        if (dot < -0.25) friction = tuning.reverseBrakeFriction;
      }
      p.vx *= Math.pow(friction, dt * 60);
      p.vy *= Math.pow(friction, dt * 60);

      applyCollisionVectorBrake(p, input, inputPower, dt);

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.squash = Math.max(0, p.squash - dt * 7);
    }

    resolveCollision(players[0], players[1]);
    checkFalls();
    updateHud();
  }

  function updateRespawns(dt) {
    for (const p of players) {
      if (p.alive || p.stocks <= 0) continue;
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) {
        p.x = p.spawnX;
        p.y = p.spawnY;
        p.alive = true;
        p.invuln = tuning.invulnTime;
        stopPlayer(p);
      }
    }
  }

  function applyCollisionVectorBrake(p, input, inputPower, dt) {
    if (p.hitTimer <= 0) {
      clearHitVector(p);
      return;
    }

    p.hitTimer = Math.max(0, p.hitTimer - dt);
    if (inputPower < tuning.deadZone) return;

    const hitLen = Math.hypot(p.hitX, p.hitY);
    if (hitLen <= 0.001) return;

    const hx = p.hitX / hitLen;
    const hy = p.hitY / hitLen;
    const againstHit = -(input.x * hx + input.y * hy);
    if (againstHit < tuning.vectorBrakeThreshold) return;

    // 衝突で吹っ飛んだ方向の速度成分だけを削る。
    // 中央方向かどうかは見ず、最後に受けた衝突ベクトルに対して逆入力した時だけ効く。
    const velocityAlongHit = p.vx * hx + p.vy * hy;
    if (velocityAlongHit <= 0) return;

    const brakePower = (againstHit - tuning.vectorBrakeThreshold) / (1 - tuning.vectorBrakeThreshold);
    const timerPower = 0.45 + 0.55 * (p.hitTimer / tuning.vectorBrakeDuration);
    const drag = velocityAlongHit * tuning.vectorBrakeDrag * brakePower * timerPower;
    const linear = tuning.vectorBrakeAccel * brakePower * timerPower;
    const remove = Math.min(velocityAlongHit, (linear + drag) * dt);

    p.vx -= hx * remove;
    p.vy -= hy * remove;
  }

  function rememberHitVector(p, x, y, power) {
    const len = Math.hypot(x, y) || 1;
    p.hitX = x / len;
    p.hitY = y / len;
    p.hitTimer = tuning.vectorBrakeDuration;
    p.hitPower = Math.max(p.hitPower || 0, power);
  }

  function limitSpeed(p, max) {
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > max) {
      p.vx = (p.vx / speed) * max;
      p.vy = (p.vy / speed) * max;
    }
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

    // 位置補正：重なりをほどいて、めり込みによる連続バグを抑える。
    const correction = overlap * 0.5 * tuning.positionCorrection;
    a.x -= nx * correction;
    a.y -= ny * correction;
    b.x += nx * correction;
    b.y += ny * correction;

    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velAlongNormal = rvx * nx + rvy * ny;
    let impact = Math.abs(velAlongNormal);

    if (velAlongNormal < 0) {
      // 同じ質量の円として、法線方向に弾性衝突インパルスを入れる。
      const impulseMag = Math.max(
        tuning.minBounceImpulse,
        (-(1 + tuning.restitution) * velAlongNormal) / 2
      );
      const ix = impulseMag * nx;
      const iy = impulseMag * ny;

      a.vx -= ix;
      a.vy -= iy;
      b.vx += ix;
      b.vy += iy;

      // 接線方向は少しだけならす。ピンボール化しすぎず、でも弾いた感は残す。
      const tangentX = -ny;
      const tangentY = nx;
      const relTangent = rvx * tangentX + rvy * tangentY;
      const tangentImpulse = relTangent * tuning.tangentDamping * 0.5;
      a.vx += tangentX * tangentImpulse;
      a.vy += tangentY * tangentImpulse;
      b.vx -= tangentX * tangentImpulse;
      b.vy -= tangentY * tangentImpulse;

      impact = Math.max(tuning.minImpact, impulseMag * 1.55);
      rememberHitVector(a, -nx, -ny, impact);
      rememberHitVector(b, nx, ny, impact);
    } else {
      // すでに離れている時のめり込みは、軽い反発だけで処理する。
      const nudge = Math.min(tuning.separatingNudge, overlap * 1.15);
      a.vx -= nx * nudge;
      a.vy -= ny * nudge;
      b.vx += nx * nudge;
      b.vy += ny * nudge;
      impact = Math.max(tuning.minImpact, nudge * 2.2);
      rememberHitVector(a, -nx, -ny, impact);
      rememberHitVector(b, nx, ny, impact);
    }

    limitSpeed(a, tuning.postCollisionMaxSpeed);
    limitSpeed(b, tuning.postCollisionMaxSpeed);
    a.squash = b.squash = Math.min(1, impact / 510);
    world.shake = Math.min(12, world.shake + impact / 62);
  }

  function checkFalls() {
    let fellThisFrame = false;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.alive) continue;
      const d = distFromCenter(p);
      if (d > world.arenaRadius + p.radius * tuning.fallForgiveness) {
        loseStock(i);
        fellThisFrame = true;
      }
    }
    if (fellThisFrame) evaluateStockWin();
  }

  function loseStock(index) {
    const p = players[index];
    p.stocks = Math.max(0, p.stocks - 1);
    p.alive = false;
    p.respawnTimer = p.stocks > 0 ? tuning.respawnTime : 0;
    p.invuln = 0;
    stopPlayer(p);
    stickInputs[index] = { x: 0, y: 0 };
    world.shake = Math.min(16, world.shake + 7);
  }

  function evaluateStockWin() {
    const out = players.filter(p => p.stocks <= 0);
    if (out.length === 0) return;
    if (out.length === 2) {
      endGame('DRAW!', '同時に最後のストックを失った！これはこれで一番マリパしてる。');
      return;
    }
    const winner = players.find(p => p.stocks > 0);
    endGame(`${winner.name} WIN!`, `${winner.name}が最後まで乗り切った！`);
  }

  function finishByTime() {
    const [a, b] = players;
    if (a.stocks > b.stocks) {
      endGame('RED WIN!', '時間切れ。ストックが多かったREDの勝ち！');
      return;
    }
    if (b.stocks > a.stocks) {
      endGame('BLUE WIN!', '時間切れ。ストックが多かったBLUEの勝ち！');
      return;
    }

    const d0 = a.alive ? distFromCenter(a) : Infinity;
    const d1 = b.alive ? distFromCenter(b) : Infinity;
    if (Math.abs(d0 - d1) < 4) endGame('DRAW!', '時間切れ。ストックも位置もほぼ同じ！');
    else if (d0 < d1) endGame('RED WIN!', '時間切れ。中央に近かったREDの勝ち！');
    else endGame('BLUE WIN!', '時間切れ。中央に近かったBLUEの勝ち！');
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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(canvas.width / world.w, canvas.height / world.h);
    const offsetX = (canvas.width - world.w * scale) / 2;
    const offsetY = (canvas.height - world.h * scale) / 2;
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

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
    const aliveAlpha = p.alive ? (p.invuln > 0 ? 0.62 + 0.25 * Math.sin(performance.now() / 70) : 1) : 0.28;

    ctx.save();
    ctx.globalAlpha = Math.max(0.28, aliveAlpha);
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
    ctx.strokeStyle = p.invuln > 0 ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.62)';
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
    roundRect(ctx, -23, 8, 46, 42, 16);
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
    ctx.strokeText(`${p.name} ♥${p.stocks}`, 0, p.radius + 98);
    ctx.fillText(`${p.name} ♥${p.stocks}`, 0, p.radius + 98);

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

    if (!p.alive && p.stocks > 0) {
      ctx.save();
      ctx.font = '900 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.strokeStyle = 'rgba(0,0,0,.5)';
      ctx.lineWidth = 7;
      const text = `${p.name} 復帰中`;
      ctx.strokeText(text, world.cx, p.name === 'RED' ? 210 : 790);
      ctx.fillText(text, world.cx, p.name === 'RED' ? 210 : 790);
      ctx.restore();
    }
  }

  function roundRect(context, x, y, width, height, radius) {
    if (typeof context.roundRect === 'function') {
      context.beginPath();
      context.roundRect(x, y, width, height, radius);
      return;
    }
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
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
      stickInputs[index] = { x: dx / max, y: dy / max };
      stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    function resetStick() {
      stickInputs[index] = { x: 0, y: 0 };
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
  timeSelect.addEventListener('change', () => {
    if (!world.running) resetGame({ start: false });
  });
  stockSelect.addEventListener('change', () => {
    if (!world.running) resetGame({ start: false });
  });

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

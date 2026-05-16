'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const livesEl = document.getElementById('lives');
const timerEl = document.getElementById('timer');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const btnStart = document.getElementById('btn-start');

// --- State ---
let state = 'idle'; // idle | playing | dead | levelup | gameover
let score = 0;
let lives = 3;
let level = 1;
let timeLeft = 60;
let timerInterval = null;
let flashTimer = 0;
let tracks = [];

const TRACTOR_W = 44;
const TRACTOR_H = 56;
const TRACTOR_SPEED_BASE = 3;
const CROP_R = 14;
const ROCK_R = 18;

let tractor = { x: W / 2, y: H / 2, angle: 0, vx: 0, vy: 0 };
let crops = [];
let rocks = [];

const keys = {};
document.addEventListener('keydown', e => { keys[e.key] = true; });
document.addEventListener('keyup', e => { keys[e.key] = false; });

// --- Helpers ---
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function livesStr(n) {
  return '❤️'.repeat(Math.max(0, n)) + '🖤'.repeat(Math.max(0, 3 - n));
}

// --- Level setup ---
function setupLevel() {
  const cropCount = 5 + level * 3;
  const rockCount = 3 + level * 2;
  tracks = [];
  crops = [];
  rocks = [];

  for (let i = 0; i < cropCount; i++) {
    let c;
    do {
      c = { x: rand(40, W - 40), y: rand(40, H - 40), collected: false };
    } while (dist(c, tractor) < 80);
    crops.push(c);
  }

  for (let i = 0; i < rockCount; i++) {
    let r;
    do {
      r = { x: rand(40, W - 40), y: rand(40, H - 40) };
    } while (dist(r, tractor) < 100 || crops.some(c => dist(r, c) < 40));
    rocks.push(r);
  }

  timeLeft = Math.max(30, 60 - (level - 1) * 5);
  updateHUD();
}

function updateHUD() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  livesEl.textContent = livesStr(lives);
  timerEl.textContent = timeLeft;
}

// --- Screens ---
function showOverlay(title, msg, btnLabel) {
  overlayTitle.textContent = title;
  overlayMsg.textContent = msg;
  btnStart.textContent = btnLabel;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function startGame() {
  score = 0;
  lives = 3;
  level = 1;
  tractor = { x: W / 2, y: H / 2, angle: -Math.PI / 2, vx: 0, vy: 0 };
  setupLevel();
  hideOverlay();
  state = 'playing';
  startTimer();
}

function startNextLevel() {
  level++;
  tractor = { x: W / 2, y: H / 2, angle: -Math.PI / 2, vx: 0, vy: 0 };
  setupLevel();
  hideOverlay();
  state = 'playing';
  startTimer();
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (state !== 'playing') return;
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 0) {
      loseLife('נגמר הזמן!');
    }
  }, 1000);
}

function loseLife(reason) {
  lives--;
  flashTimer = 40;
  updateHUD();
  if (lives <= 0) {
    state = 'gameover';
    clearInterval(timerInterval);
    showOverlay('משחק נגמר! 💀', `${reason}\nניקוד סופי: ${score}`, 'שחק שוב');
  } else {
    tractor.x = W / 2;
    tractor.y = H / 2;
    tractor.vx = 0;
    tractor.vy = 0;
  }
}

// --- Drawing ---
function drawGrass() {
  ctx.fillStyle = '#5a8a30';
  ctx.fillRect(0, 0, W, H);

  // Grid lines (field rows)
  ctx.strokeStyle = 'rgba(80,120,40,0.4)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
}

function drawTracks() {
  ctx.strokeStyle = 'rgba(100, 70, 20, 0.45)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (let i = 1; i < tracks.length; i++) {
    const prev = tracks[i - 1];
    const cur = tracks[i];
    if (cur.newStroke) continue;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(cur.x, cur.y);
    ctx.stroke();
  }
}

function drawCrops() {
  crops.forEach(c => {
    if (c.collected) return;
    // Wheat stalk
    ctx.fillStyle = '#e8c44a';
    ctx.font = '26px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌾', c.x, c.y);
  });
}

function drawRocks() {
  rocks.forEach(r => {
    ctx.font = '30px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪨', r.x, r.y);
  });
}

function drawTractor() {
  ctx.save();
  ctx.translate(tractor.x, tractor.y);
  ctx.rotate(tractor.angle + Math.PI / 2);

  // Body
  ctx.fillStyle = '#d44000';
  ctx.beginPath();
  ctx.roundRect(-14, -24, 28, 42, 6);
  ctx.fill();

  // Cab
  ctx.fillStyle = '#b83500';
  ctx.beginPath();
  ctx.roundRect(-10, -28, 20, 18, 4);
  ctx.fill();

  // Window
  ctx.fillStyle = '#a8d8ff';
  ctx.beginPath();
  ctx.roundRect(-7, -26, 14, 12, 3);
  ctx.fill();

  // Exhaust pipe
  ctx.fillStyle = '#555';
  ctx.fillRect(8, -20, 5, 12);

  // Big rear wheels
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.ellipse(-16, 10, 8, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(16, 10, 8, 12, 0, 0, Math.PI * 2); ctx.fill();
  // Wheel rims
  ctx.fillStyle = '#888';
  ctx.beginPath(); ctx.ellipse(-16, 10, 4, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(16, 10, 4, 7, 0, 0, Math.PI * 2); ctx.fill();

  // Small front wheels
  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.ellipse(-10, -18, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10, -18, 5, 7, 0, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawFlash() {
  if (flashTimer > 0) {
    ctx.fillStyle = `rgba(255,0,0,${(flashTimer / 40) * 0.35})`;
    ctx.fillRect(0, 0, W, H);
    flashTimer--;
  }
}

// --- Update ---
function update() {
  if (state !== 'playing') return;

  const speed = TRACTOR_SPEED_BASE + level * 0.4;
  let moving = false;

  if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
    tractor.angle -= 0.06;
    moving = true;
  }
  if (keys['ArrowRight'] || keys['d'] || keys['D']) {
    tractor.angle += 0.06;
    moving = true;
  }
  if (keys['ArrowUp'] || keys['w'] || keys['W']) {
    tractor.vx = Math.cos(tractor.angle) * speed;
    tractor.vy = Math.sin(tractor.angle) * speed;
    moving = true;
  } else if (keys['ArrowDown'] || keys['s'] || keys['S']) {
    tractor.vx = -Math.cos(tractor.angle) * speed * 0.5;
    tractor.vy = -Math.sin(tractor.angle) * speed * 0.5;
    moving = true;
  } else {
    tractor.vx *= 0.8;
    tractor.vy *= 0.8;
  }

  tractor.x = Math.max(TRACTOR_W / 2, Math.min(W - TRACTOR_W / 2, tractor.x + tractor.vx));
  tractor.y = Math.max(TRACTOR_H / 2, Math.min(H - TRACTOR_H / 2, tractor.y + tractor.vy));

  if (moving || Math.hypot(tractor.vx, tractor.vy) > 0.5) {
    tracks.push({ x: tractor.x, y: tractor.y, newStroke: false });
    if (tracks.length > 400) tracks.shift();
  }

  // Crop collection
  crops.forEach(c => {
    if (!c.collected && dist(tractor, c) < CROP_R + 18) {
      c.collected = true;
      score += 10 * level;
      updateHUD();
    }
  });

  // Rock collision
  if (flashTimer === 0) {
    rocks.forEach(r => {
      if (dist(tractor, r) < ROCK_R + 14) {
        tractor.vx = -tractor.vx * 2;
        tractor.vy = -tractor.vy * 2;
        tractor.x += tractor.vx;
        tractor.y += tractor.vy;
        if (flashTimer === 0) loseLife('נפגעת מאבן! 🪨');
      }
    });
  }

  // Level complete
  if (crops.every(c => c.collected)) {
    state = 'levelup';
    clearInterval(timerInterval);
    score += timeLeft * 5;
    updateHUD();
    showOverlay(
      `רמה ${level} הושלמה! 🎉`,
      `אספת את כל התבואה!\nבונוס זמן: +${timeLeft * 5} נקודות\nניקוד: ${score}`,
      'לרמה הבאה!'
    );
  }
}

// --- Game Loop ---
function loop() {
  update();
  drawGrass();
  drawTracks();
  drawCrops();
  drawRocks();
  drawTractor();
  drawFlash();
  requestAnimationFrame(loop);
}

// --- Init ---
btnStart.addEventListener('click', () => {
  if (state === 'idle' || state === 'gameover') {
    startGame();
  } else if (state === 'levelup') {
    startNextLevel();
  }
});

showOverlay('🚜 משחק הטרקטור של גפן 🚜', 'אסוף תבואה 🌾, הימנע מאבנים 🪨\nחצים לנהיגה, שמאל/ימין לפנייה', 'התחל משחק!');
loop();

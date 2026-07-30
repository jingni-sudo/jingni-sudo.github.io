document.documentElement.classList.add("js-ready");

const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#site-navigation");

menuToggle?.addEventListener("click", () => {
  const isOpen = navigation.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

navigation?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navigation.classList.remove("is-open");
    menuToggle?.setAttribute("aria-expanded", "false");
  });
});

const canvas = document.querySelector("#game-canvas");
const context = canvas?.getContext("2d");
const scoreElement = document.querySelector("#score");
const highScoreElement = document.querySelector("#high-score");
const statusElement = document.querySelector("#game-status");
const startButton = document.querySelector("#start-game");
const pauseButton = document.querySelector("#pause-game");
const restartButton = document.querySelector("#restart-game");

const GAME_WIDTH = 720;
const GAME_HEIGHT = 420;
const PLAYER_SPEED = 150;
const ENEMY_SPEED = PLAYER_SPEED * 0.7;
const STAR_LIMIT = 2;
const BOMB_INTERVAL = 3000;
const BOMB_COUNTDOWN = 2000;
const EXPLOSION_DURATION = 800;
const EXPLOSION_RADIUS = 80;
const SAFE_DISTANCE = 150;
const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const SPACE_DUST = [
  [34, 42, 1], [92, 106, 1.5], [158, 58, 1], [224, 142, 1.2], [296, 76, .8], [366, 38, 1.4],
  [438, 122, 1], [512, 64, 1.3], [586, 154, .9], [662, 48, 1.2], [54, 304, 1.1], [132, 366, .8],
  [208, 278, 1.4], [286, 338, .9], [354, 244, 1.1], [428, 354, 1.5], [506, 292, .8], [574, 374, 1.2], [664, 266, 1]
];

let game = null;
let animationFrame = null;
let highScore = Number(localStorage.getItem("jieun-worm-high-score") || 0);
highScoreElement.textContent = String(highScore);

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function randomPosition(minDistance = 0) {
  const player = game?.player?.[0] || { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };
  let position = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };
  for (let attempt = 0; attempt < 40; attempt += 1) {
    position = { x: randomBetween(24, GAME_WIDTH - 24), y: randomBetween(24, GAME_HEIGHT - 24) };
    if (distanceBetween(position, player) >= minDistance) return position;
  }
  return position;
}

function createEnemy() {
  const position = randomPosition(SAFE_DISTANCE);
  const angle = randomBetween(0, Math.PI * 2);
  return { ...position, vx: Math.cos(angle) * ENEMY_SPEED, vy: Math.sin(angle) * ENEMY_SPEED, radius: 9 };
}

function resetGame() {
  game = {
    player: [{ x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 }],
    direction: { ...DIRECTIONS.right },
    nextDirection: { ...DIRECTIONS.right },
    stars: [],
    starRespawns: [],
    enemies: [],
    bombs: [],
    score: 0,
    elapsed: 0,
    nextBombAt: BOMB_INTERVAL,
    running: false,
    paused: false,
    gameOver: false,
    lastTimestamp: 0,
    swipeStart: null,
  };
  for (let index = 0; index < STAR_LIMIT; index += 1) spawnStar();
  for (let index = 0; index < 3; index += 1) game.enemies.push(createEnemy());
  updateHud("시작 전");
  drawGame();
}

function spawnStar() {
  if (game.stars.length >= STAR_LIMIT) return;
  const position = randomPosition(70);
  game.stars.push({ ...position, radius: 9, expiresAt: game.elapsed + 7000 });
}

function scheduleStarRespawn() {
  game.starRespawns.push(game.elapsed + 2000);
}

function spawnBomb() {
  const position = randomPosition(SAFE_DISTANCE);
  game.bombs.push({ ...position, createdAt: game.elapsed, explodedAt: null });
}

function updateHud(status = statusElement.textContent) {
  scoreElement.textContent = String(Math.floor(game?.score || 0));
  highScoreElement.textContent = String(highScore);
  statusElement.textContent = status;
}

function setDirection(directionName) {
  const next = DIRECTIONS[directionName];
  if (!next || !game || game.gameOver) return;
  if (next.x + game.direction.x === 0 && next.y + game.direction.y === 0) return;
  game.nextDirection = { ...next };
}

function handleKey(event) {
  const keyMap = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
  const codeMap = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
  const direction = keyMap[event.key] || codeMap[event.code];
  if (direction) {
    event.preventDefault();
    setDirection(direction);
  }
  if (event.key.toLowerCase() === "p") togglePause();
}

function movePlayer(delta) {
  game.direction = { ...game.nextDirection };
  const head = game.player[0];
  const nextHead = { x: head.x + game.direction.x * PLAYER_SPEED * delta, y: head.y + game.direction.y * PLAYER_SPEED * delta };
  nextHead.x = Math.max(10, Math.min(GAME_WIDTH - 10, nextHead.x));
  nextHead.y = Math.max(10, Math.min(GAME_HEIGHT - 10, nextHead.y));
  game.player.unshift(nextHead);
  const desiredLength = 5 + Math.floor(game.score / 10);
  while (game.player.length > desiredLength) game.player.pop();
}

function updateStars() {
  game.stars = game.stars.filter((star) => {
    if (game.elapsed >= star.expiresAt) {
      scheduleStarRespawn();
      return false;
    }
    if (distanceBetween(game.player[0], star) < 18) {
      game.score += 10;
      scheduleStarRespawn();
      return false;
    }
    return true;
  });
  game.starRespawns = game.starRespawns.filter((respawnAt) => {
    if (game.elapsed >= respawnAt) {
      spawnStar();
      return false;
    }
    return true;
  });
  while (game.stars.length + game.starRespawns.length < STAR_LIMIT) scheduleStarRespawn();
}

function updateEnemies(delta) {
  const speedMultiplier = 1 + Math.floor(game.score / 50) * 0.1;
  game.enemies.forEach((enemy) => {
    enemy.x += enemy.vx * speedMultiplier * delta;
    enemy.y += enemy.vy * speedMultiplier * delta;
    if (enemy.x < enemy.radius || enemy.x > GAME_WIDTH - enemy.radius) {
      enemy.vx *= -1;
      enemy.x = Math.max(enemy.radius, Math.min(GAME_WIDTH - enemy.radius, enemy.x));
    }
    if (enemy.y < enemy.radius || enemy.y > GAME_HEIGHT - enemy.radius) {
      enemy.vy *= -1;
      enemy.y = Math.max(enemy.radius, Math.min(GAME_HEIGHT - enemy.radius, enemy.y));
    }
  });
  const desiredEnemies = Math.min(6, 3 + Math.floor(game.score / 100));
  while (game.enemies.length < desiredEnemies) game.enemies.push(createEnemy());
}

function updateBombs() {
  if (game.elapsed >= game.nextBombAt) {
    spawnBomb();
    game.nextBombAt += BOMB_INTERVAL;
  }
  game.bombs = game.bombs.filter((bomb) => {
    if (!bomb.explodedAt && game.elapsed - bomb.createdAt >= BOMB_COUNTDOWN) bomb.explodedAt = game.elapsed;
    if (bomb.explodedAt && game.elapsed - bomb.explodedAt > EXPLOSION_DURATION) return false;
    return true;
  });
}

function checkCollisions() {
  const head = game.player[0];
  if (game.player.slice(4).some((segment) => distanceBetween(head, segment) < 10)) endGame();
  if (game.enemies.some((enemy) => distanceBetween(head, enemy) < enemy.radius + 8)) endGame();
  if (game.bombs.some((bomb) => bomb.explodedAt && game.elapsed - bomb.explodedAt <= EXPLOSION_DURATION && distanceBetween(head, bomb) <= EXPLOSION_RADIUS)) endGame();
}

function update(delta) {
  game.elapsed += delta * 1000;
  game.score += delta;
  movePlayer(delta);
  updateStars();
  updateEnemies(delta);
  updateBombs();
  checkCollisions();
  updateHud(game.paused ? "일시정지" : "진행 중");
}

function drawStar(star) {
  context.fillStyle = "#f4b942";
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + point * Math.PI / 5;
    const radius = point % 2 === 0 ? star.radius : star.radius / 2;
    const x = star.x + Math.cos(angle) * radius;
    const y = star.y + Math.sin(angle) * radius;
    point === 0 ? context.moveTo(x, y) : context.lineTo(x, y);
  }
  context.closePath();
  context.fill();
}

function drawGame() {
  if (!context || !game) return;
  context.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  const spaceGradient = context.createLinearGradient(0, 0, GAME_WIDTH, GAME_HEIGHT);
  spaceGradient.addColorStop(0, "#0b1020");
  spaceGradient.addColorStop(0.55, "#171b35");
  spaceGradient.addColorStop(1, "#241b35");
  context.fillStyle = spaceGradient;
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  context.fillStyle = "#9aa8c4";
  SPACE_DUST.forEach(([x, y, radius]) => {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  });
  game.stars.forEach(drawStar);
  game.enemies.forEach((enemy) => {
    context.fillStyle = "#c15f3c";
    context.beginPath();
    context.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    context.fill();
  });
  game.bombs.forEach((bomb) => {
    const exploding = bomb.explodedAt && game.elapsed - bomb.explodedAt <= EXPLOSION_DURATION;
    context.strokeStyle = exploding ? "#f4b942" : "#d8cfc4";
    context.lineWidth = exploding ? 4 : 2;
    context.beginPath();
    context.arc(bomb.x, bomb.y, exploding ? EXPLOSION_RADIUS : 12, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = exploding ? "#f4b942" : "#d8cfc4";
    context.font = "12px sans-serif";
    context.textAlign = "center";
    context.fillText(exploding ? "!" : Math.max(0, Math.ceil((BOMB_COUNTDOWN - (game.elapsed - bomb.createdAt)) / 1000)), bomb.x, bomb.y + 4);
  });
  if (game.player.length > 1) {
    context.strokeStyle = "#c96b4d";
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 14;
    context.beginPath();
    game.player.forEach((segment, index) => {
      index === 0 ? context.moveTo(segment.x, segment.y) : context.lineTo(segment.x, segment.y);
    });
    context.stroke();
  }
  game.player.forEach((segment, index) => {
    const radius = Math.max(4.5, 10 - index * 0.45);
    context.fillStyle = index === 0 ? "#d97757" : "#c96b4d";
    context.beginPath();
    context.arc(segment.x, segment.y, radius, 0, Math.PI * 2);
    context.fill();
  });
  const head = game.player[0];
  const perpendicular = { x: -game.direction.y, y: game.direction.x };
  const eyeCenter = { x: head.x + game.direction.x * 3, y: head.y + game.direction.y * 3 };
  context.fillStyle = "#2f2722";
  [1, -1].forEach((side) => {
    context.beginPath();
    context.arc(eyeCenter.x + perpendicular.x * side * 3, eyeCenter.y + perpendicular.y * side * 3, 1.8, 0, Math.PI * 2);
    context.fill();
  });
}

function gameLoop(timestamp) {
  if (!game.running) {
    animationFrame = null;
    return;
  }
  const delta = Math.min((timestamp - game.lastTimestamp) / 1000 || 0, 0.05);
  game.lastTimestamp = timestamp;
  if (!game.paused && !game.gameOver) update(delta);
  drawGame();
  if (game.running) animationFrame = requestAnimationFrame(gameLoop);
  else animationFrame = null;
}

function startGame(forceRestart = false) {
  if (!forceRestart && game.running && !game.gameOver && !game.paused) return;
  resetGame();
  game.running = true;
  game.lastTimestamp = performance.now();
  canvas?.focus({ preventScroll: true });
  startButton.disabled = true;
  pauseButton.disabled = false;
  pauseButton.textContent = "일시정지";
  updateHud("진행 중");
  if (animationFrame === null) animationFrame = requestAnimationFrame(gameLoop);
}

function togglePause() {
  if (!game.running || game.gameOver) return;
  game.paused = !game.paused;
  pauseButton.textContent = game.paused ? "계속하기" : "일시정지";
  updateHud(game.paused ? "일시정지" : "진행 중");
}

function endGame() {
  if (game.gameOver) return;
  game.gameOver = true;
  game.running = false;
  const finalScore = Math.floor(game.score);
  if (finalScore > highScore) {
    highScore = finalScore;
    localStorage.setItem("jieun-worm-high-score", String(highScore));
  }
  startButton.disabled = false;
  pauseButton.disabled = true;
  pauseButton.textContent = "일시정지";
  updateHud("게임 오버");
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}

function handleSwipeStart(event) {
  game.swipeStart = { x: event.clientX, y: event.clientY };
}

function handleSwipeEnd(event) {
  if (!game.swipeStart) return;
  const dx = event.clientX - game.swipeStart.x;
  const dy = event.clientY - game.swipeStart.y;
  game.swipeStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? "right" : "left");
  else setDirection(dy > 0 ? "down" : "up");
}

window.addEventListener("keydown", handleKey, { capture: true });
document.querySelectorAll("[data-direction]").forEach((button) => {
  button.addEventListener("pointerdown", () => setDirection(button.dataset.direction));
});
canvas?.addEventListener("pointerdown", handleSwipeStart);
canvas?.addEventListener("pointerup", handleSwipeEnd);
startButton?.addEventListener("click", startGame);
pauseButton?.addEventListener("click", togglePause);
restartButton?.addEventListener("click", () => startGame(true));

resetGame();

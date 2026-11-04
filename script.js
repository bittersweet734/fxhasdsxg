// MUSIC PLACEHOLDERS: put your two MP3 files in the audio folder.
const MUSIC_TRACKS = {
  lobby: "assets/lobby.mp3",
  christmas: "assets/christmas.mp3",
  halloween: "assets/haloween.mp3"
};
let activeMusicMode = null;

let bootPhase = "welcome",
  bootStarted = 0,
  bootStage = -1;
const BOOT_DURATION = 5000;
let selectedMode = "christmas";
try {
  if (localStorage.getItem("snowRunMode") === "halloween")
    selectedMode = "halloween";
} catch {}
function scoreKey() {
  return selectedMode === "halloween"
    ? "snowRunHalloweenBest"
    : "santaPlatformBest";
}
const actionIcons = {
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  retry: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M16 3a4 4 0 0 1 0 8"/><circle cx="9" cy="7" r="4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  jump: '<path d="M4 20h16M12 16V3m-5 5 5-5 5 5M5 16l2-3m12 3-2-3"/>',
  trophy:
    '<path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm4 10v5m-4 3h8m-7-3h6M8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4"/>',
  loading: '<path d="M12 3a9 9 0 1 1-9 9"/>',
};
function setAction(button, label) {
  const name = label.startsWith("Run again")
    ? "retry"
    : label.startsWith("Loading")
      ? "loading"
      : "play";
  button.innerHTML =
    '<svg class="action-icon ' +
    (name === "loading" ? "loading-icon" : "") +
    '" viewBox="0 0 24 24" aria-hidden="true">' +
    actionIcons[name] +
    "</svg><span>" +
    label.replace(/\s*→$/, "") +
    "</span>";
}
const $ = (id) => document.getElementById(id),
  c = $("canvas"),
  ctx = c.getContext("2d"),
  characterCanvas = $("character"),
  characterCtx = characterCanvas.getContext("2d");
let W = 1100,
  H = 620,
  viewHeight = 620,
  sceneOffset = 0,
  state = "welcome",
  last = 0,
  time = 0,
  distance = 0,
  gifts = 0,
  best = 0,
  speed = 250,
  scroll = 0,
  flyers = [],
  nightBlend = 0,
  nightAnnounced = false,
  milestoneTimer = 0,
  platformNumber = 0,
  platforms = [],
  items = [],
  snow = [],
  player = { x: 170, y: 400, vy: 0, grounded: true },
  sound = false,
  audio;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
try {
  best = +localStorage.getItem(scoreKey()) || 0;
} catch {}
$("best").textContent = best;
const modeMusic={lobby:$('lobbyMusic'),christmas:$('christmasMusic'),halloween:$('halloweenMusic')};for(const track of Object.values(modeMusic))track.volume=.45;
function playModeMusic(mode){if(!modeMusic[mode])return;for(const [name,track] of Object.entries(modeMusic)){if(name!==mode){track.pause();try{track.currentTime=0}catch{}}}const track=modeMusic[mode];if(track.dataset.sourcePath!==MUSIC_TRACKS[mode]){track.src=MUSIC_TRACKS[mode];track.dataset.sourcePath=MUSIC_TRACKS[mode]}activeMusicMode=mode;try{const attempt=track.play();if(attempt&&typeof attempt.catch==='function')attempt.catch(()=>{})}catch{}}
function pauseModeMusic(){for(const track of Object.values(modeMusic))track.pause()}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseModeMusic()});

function viewportLayout(width, height) {
  const logicalWidth = Math.max(760, (620 * width) / height),
    logicalHeight = (logicalWidth * height) / width;
  return {
    width: logicalWidth,
    height: logicalHeight,
    offset: Math.max(0, (logicalHeight - 620) * 0.42),
  };
}
function resize() {
  const screenWidth = Math.round(window.visualViewport?.width || innerWidth),
    screenHeight = Math.round(window.visualViewport?.height || innerHeight),
    layout = viewportLayout(screenWidth, screenHeight);
  document.documentElement.style.setProperty(
    "--app-height",
    screenHeight + "px",
  );
  W = layout.width;
  H = 620;
  viewHeight = layout.height;
  sceneOffset = layout.offset;
  c.width = Math.round(W / 3);
  c.height = Math.round(viewHeight / 3);
  ctx.setTransform(
    c.width / W,
    0,
    0,
    c.height / viewHeight,
    0,
    (sceneOffset * c.height) / viewHeight,
  );
  ctx.imageSmoothingEnabled = false;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  characterCanvas.width = Math.round(screenWidth * dpr);
  characterCanvas.height = Math.round(screenHeight * dpr);
  characterCtx.setTransform(
    characterCanvas.width / W,
    0,
    0,
    characterCanvas.height / viewHeight,
    0,
    (sceneOffset * characterCanvas.height) / viewHeight,
  );
  characterCtx.imageSmoothingEnabled = false;
  const oldX = player.x;
  player.x = Math.min(170, W * 0.21);
  const dx = player.x - oldX;
  for (const p of platforms) p.x += dx;
  for (const it of items) it.x += dx;
  for (const bat of flyers) bat.x += dx;
}
addEventListener("resize", resize);
window.visualViewport?.addEventListener("resize", resize);
resize();
snow = Array.from({ length: reduced ? 25 : 95 }, () => ({
  x: Math.random() * 1500,
  y: Math.random() * 620,
  r: 1 + Math.random() * 3,
  v: 18 + Math.random() * 40,
}));
function tone(f, d = 0.12) {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.connect(g);
    g.connect(audio.destination);
    o.frequency.value = f;
    g.gain.setValueAtTime(0.06, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + d);
    o.start();
    o.stop(audio.currentTime + d);
  } catch {}
}
const START_SPEED = 250,
  MAX_SPEED = 550,
  SPEED_CAP_POINTS = 2000;
function difficulty(points) {
  const progress = Math.min(1, Math.max(0, points) / SPEED_CAP_POINTS);
  return {
    level: 1 + Math.floor(Math.max(0, points) / 240),
    speed: START_SPEED + (MAX_SPEED - START_SPEED) * progress,
    maxSpeed: progress === 1,
    night: points >= 720,
  };
}
function extend() {
  let edge = platforms.at(-1);
  const d = difficulty(distance);
  while (edge.x + edge.w < W + 700) {
    const gap = Math.min(
        d.speed * 0.44,
        100 + Math.random() * 45 + (d.level - 1) * 9,
      ),
      py = Math.max(
        385,
        Math.min(
          475,
          edge.y + (Math.random() - 0.5) * (65 + Math.min(d.level * 3, 30)),
        ),
      );
    platformNumber++;
    const hasBat =
      d.night &&
      platformNumber % Math.max(2, 4 - Math.floor((d.level - 4) / 4)) === 0;
    edge = {
      x: edge.x + edge.w + gap,
      w: hasBat
        ? Math.max(740, d.speed * 1.7) + Math.random() * 100
        : Math.max(300, d.speed * 0.9, 340 - (d.level - 1) * 9) +
          Math.random() * 190,
      y: py,
    };
    platforms.push(edge);
    items.push({ x: edge.x + edge.w * 0.48, y: edge.y - 45, taken: false });
    if (hasBat) {
      const high = platformNumber % 3 === 0;
      flyers.push({
        x: edge.x + Math.max(240, d.speed * 0.7),
        baseY: py - (high ? 190 : 58),
        y: py - (high ? 190 : 58),
        phase: Math.random() * 6,
        high,
      });
    }
  }
}

function setup() {
  distance = 0;
  flyers = [];
  nightBlend = 0;
  nightAnnounced = false;
  milestoneTimer = 0;
  platformNumber = 0;
  $("milestone").hidden = true;
  $("stageStatus").textContent =
    (selectedMode === "halloween" ? "DUSK" : "DAY") + " · LEVEL 1";
  document.body.classList.remove("night");
  platforms = [{ x: -200, w: 820, y: 445 }];
  items = [];
  extend();
  player = { x: Math.min(170, W * 0.21), y: 445, vy: 0, grounded: true };
  scroll = 0;
  distance = 0;
  gifts = 0;
  speed = 250;
  time = 0;
  $("score").textContent = 0;
  $("gifts").textContent = 0;
}
setup();
function begin() {
  if (bootPhase !== "ready") return;
  if (!characterData[selectedCharacter].ready) {
    $("message").textContent =
      "Your runner is getting ready. Please wait a moment.";
    return;
  }
  playModeMusic(selectedMode);
  $("characterPicker").hidden = true;
  $("modePicker").hidden = true;
  $("changeCharacter").hidden = true;
  $("overlay").classList.remove("selection-screen");
  $("overlay").classList.remove("game-over", "pause-screen");
  $("results").hidden = true;
  $("screenLabel").textContent = "NORTH POLE ADVENTURE";
  setup();
  state = "running";
  $("overlay").hidden = true;
  tone(660);
}
function jump() {
  if (bootPhase !== "ready") return;
  if (state === "ready" || state === "over") {
    begin();
    return;
  }
  if (state === "running" && player.grounded) {
    player.vy = -675;
    player.grounded = false;
    tone(740);
  }
}
function pause() {
  if (state === "running") {
    state = "paused";
    $("overlay").classList.add("pause-screen");
    $("title").textContent =
      selectedMode === "halloween" ? "A spooky little break" : "Cocoa break";
    $("message").textContent = "Ready for another leap?";
    setAction($("start"), "Resume →");
    $("overlay").hidden = false;
  } else if (state === "paused") {
    $("overlay").classList.remove("pause-screen");
    state = "running";
    $("overlay").hidden = true;
    playModeMusic(selectedMode);
  }
}
function end() {
  state = "over";
  $("milestone").hidden = true;
  const points = Math.floor(distance),
    newRecord = points > best;
  best = Math.max(best, points);
  try {
    localStorage.setItem(scoreKey(), best);
  } catch {}
  $("best").textContent = best;
  $("screenLabel").textContent = "RUN COMPLETE";
  $("title").textContent = "Nice run!";
  $("message").textContent =
    selectedMode === "halloween"
      ? "Another spooky adventure is one jump away."
      : "Another snowy adventure is one jump away.";
  $("currentPoints").textContent = points.toLocaleString();
  $("highestPoints").textContent = best.toLocaleString();
  $("runDetails").textContent =
    `${Math.floor(distance)} metres travelled · ${gifts} ${selectedMode === "halloween" ? "pumpkins" : "gifts"} collected`;
  $("record").hidden = !newRecord;
  $("results").hidden = false;
  $("overlay").classList.add("game-over");
  $("changeCharacter").hidden = false;
  setAction($("start"), "Run again →");
  $("overlay").hidden = false;
  tone(180, 0.3);
}
$("start").onclick = () => (state === "paused" ? pause() : begin());
$("changeCharacter").onclick = showCharacterPicker;
function pressJump(e) {
  if (e.type === "pointerdown" && e.button !== 0) return;
  e.preventDefault();
  jump();
}
if ("PointerEvent" in window) {
  $("jump").addEventListener("pointerdown", pressJump);
  c.addEventListener("pointerdown", pressJump);
} else {
  $("jump").addEventListener("touchstart", pressJump, { passive: false });
  c.addEventListener("touchstart", pressJump, { passive: false });
  $("jump").addEventListener("mousedown", (e) => {
    if (!("ontouchstart" in window)) pressJump(e);
  });
  c.addEventListener("mousedown", (e) => {
    if (!("ontouchstart" in window)) pressJump(e);
  });
}
$("jump").addEventListener("click", (e) => {
  if (e.detail === 0) {
    e.preventDefault();
    jump();
  }
});
document.addEventListener("keydown", (e) => {
  if (
    e.target.closest(
      "[data-character], [data-mode], #launch, #start, #changeCharacter",
    )
  )
    return;
  if (["Space", "ArrowUp", "KeyW"].includes(e.code)) {
    e.preventDefault();
    if (!e.repeat) jump();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "running") pause();
});
function ellipse(x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function path(points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}
function round(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.fill();
}
function pine(x, y, h) {
  round(x - 4, y - 12, 8, 23, 2, "#6e7771");
  for (let i = 0; i < 3; i++) {
    let top = y - h + i * h * 0.22,
      width = h * (0.25 + i * 0.07);
    path(
      [
        [x, top],
        [x - width, top + h * 0.52],
        [x + width, top + h * 0.52],
      ],
      "#508c7e",
    );
    path(
      [
        [x, top],
        [x - width * 0.75, top + h * 0.28],
        [x - 5, top + h * 0.22],
        [x + width * 0.65, top + h * 0.28],
      ],
      "#eef6ec",
    );
  }
}
function cloud(x, y, s) {
  ellipse(x, y, 49 * s, 14 * s, "#f8fcf4");
  ellipse(x - 18 * s, y - 8 * s, 22 * s, 20 * s, "#f8fcf4");
  ellipse(x + 8 * s, y - 14 * s, 27 * s, 25 * s, "#f8fcf4");
  ellipse(x + 36 * s, y - 3 * s, 23 * s, 15 * s, "#f8fcf4");
}
const characterData = {
  anne: { name: "Anne", file: "pixel-runner-profile.png" },
  thea: {
    name: "Thea",
    file: "thea-cycle.png",
    runFrames: [0, 1, 2, 3, 0, 1, 2, 3],
  },
  mj: { name: "MJ", file: "mj-cycle.png", runFrames: [0, 1, 2, 3, 0, 1, 2, 3] },
  lander: {
    name: "Lander",
    file: "lander-cycle.png",
    runFrames: [0, 1, 2, 3, 0, 1, 2, 3],
  },
};
let selectedCharacter = "anne";
try {
  const saved = localStorage.getItem("snowRunCharacter");
  if (characterData[saved]) selectedCharacter = saved;
} catch {}
for (const [key, item] of Object.entries(characterData)) {
  item.image = new Image();
  item.ready = false;
  item.image.onload = () => {
    item.ready = true;
    if (key === selectedCharacter) updateSelection();
  };
  item.image.onerror = () => {
    item.failed = true;
    if (key === selectedCharacter) {
      $("message").textContent =
        "Character could not load. Refresh or choose another runner.";
      $("start").disabled = true;
    }
  };
  item.image.src = item.file;
}
function updateSelection() {
  const active = characterData[selectedCharacter];
  document.querySelectorAll("[data-character]").forEach((card) => {
    card.setAttribute(
      "aria-pressed",
      String(card.dataset.character === selectedCharacter),
    );
  });
  if ($("overlay").classList.contains("selection-screen")) {
    setAction(
      $("start"),
      active.ready
        ? "Start as " + active.name + " →"
        : "Loading " + active.name + "...",
    );
    $("start").disabled = !active.ready;
  }
}
document.querySelectorAll("[data-character]").forEach(
  (card) =>
    (card.onclick = () => {
      selectedCharacter = card.dataset.character;
      try {
        localStorage.setItem("snowRunCharacter", selectedCharacter);
      } catch {}
      $("message").textContent =
        selectedMode === "halloween"
          ? "Collect pumpkins. Brave the haunted trail."
          : "Leap across the snow. Collect gifts. Beat your best.";
      updateSelection();
    }),
);
function showCharacterPicker() {
  playModeMusic("lobby");
  state = "ready";
  setup();
  $("overlay").classList.remove("game-over", "pause-screen");
  $("overlay").classList.add("selection-screen");
  $("results").hidden = true;
  $("characterPicker").hidden = false;
  $("modePicker").hidden = false;
  $("changeCharacter").hidden = true;
  $("screenLabel").textContent = "CHOOSE YOUR RUNNER";
  $("title").textContent =
    selectedMode === "halloween" ? "Pixel Halloween Run" : "Pixel Snow Run";
  $("message").textContent =
    selectedMode === "halloween"
      ? "Collect pumpkins. Brave the haunted trail."
      : "Collect gifts. Nightfall begins at 720 points.";
  $("overlay").hidden = false;
  updateSelection();
}
function drawSprite(context, img, frame, x, y, h, sequence) {
  if (sequence) frame = sequence[frame % sequence.length];
  if (!img.complete || !img.naturalWidth) return;
  const col = frame % 4,
    row = Math.floor(frame / 4),
    sx = Math.round((col * img.naturalWidth) / 4),
    sy = Math.round((row * img.naturalHeight) / 2),
    sw = Math.round(((col + 1) * img.naturalWidth) / 4) - sx,
    sh = Math.round(((row + 1) * img.naturalHeight) / 2) - sy,
    w = (h * sw) / sh;
  context.drawImage(img, sx, sy, sw, sh, x - w / 2, y - h + 5, w, h);
}
function drawPreviews(t) {
  if ($("characterPicker").hidden) return;
  const frame = reduced ? 0 : Math.floor(t / 100) % 8;
  for (const card of document.querySelectorAll("[data-character]")) {
    const cv = card.querySelector("canvas"),
      cx = cv.getContext("2d"),
      item = characterData[card.dataset.character];
    cx.clearRect(0, 0, 200, 200);
    cx.imageSmoothingEnabled = false;
    if (item.ready)
      drawSprite(cx, item.image, frame, 100, 188, 187, item.runFrames);
  }
}
function updateModeUI() {
  c.setAttribute(
    "aria-label",
    (selectedMode === "halloween" ? "Halloween" : "Christmas") +
      " platform runner. Tap Jump or press Space to jump across gaps.",
  );
  document.body.classList.toggle("halloween", selectedMode === "halloween");
  document.title =
    selectedMode === "halloween" ? "Pixel Halloween Run" : "Pixel Snow Run";
  $("title").textContent = document.title;
  $("collectLabel").textContent =
    selectedMode === "halloween" ? "PUMPKINS" : "GIFTS";
  $("message").textContent =
    selectedMode === "halloween"
      ? "Collect pumpkins. Brave the haunted trail."
      : "Collect gifts. Nightfall begins at 720 points.";
  document
    .querySelectorAll("[data-mode]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.mode === selectedMode),
      ),
    );
}
document.querySelectorAll("[data-mode]").forEach(
  (button) =>
    (button.onclick = () => {
      selectedMode = button.dataset.mode;
      playModeMusic(selectedMode);
      try {
        localStorage.setItem("snowRunMode", selectedMode);
        best = +localStorage.getItem(scoreKey()) || 0;
      } catch {
        best = 0;
      }
      $("best").textContent = best;
      setup();
      updateModeUI();
    }),
);
updateModeUI();
updateSelection();
function santa() {
  const ctx = characterCtx;
  ctx.clearRect(0, -sceneOffset, W, viewHeight);
  const item = characterData[selectedCharacter];
  if (!item.ready) return;
  const moving = state === "running" && player.grounded,
    frame = moving ? Math.floor(time * 12) % 8 : 3;
  drawSprite(
    ctx,
    item.image,
    frame,
    Math.round(player.x),
    Math.round(player.y),
    158,
    moving ? item.runFrames : undefined,
  );
}
function gift(it) {
  if (selectedMode === "halloween") {
    drawPumpkin(it);
    return;
  }
  let bob = Math.sin(time * 3 + it.x * 0.01) * 3;
  round(it.x - 13, it.y - 14 + bob, 26, 26, 3, "#df5e50");
  round(it.x - 15, it.y - 15 + bob, 30, 7, 2, "#ef7963");
  round(it.x - 3, it.y - 15 + bob, 6, 27, 1, "#ffe09b");
  ctx.strokeStyle = "#ffe09b";
  ctx.lineWidth = 3;
  for (let k of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(it.x + k * 5, it.y - 19 + bob, 6, 4, k * 0.4, 0, 7);
    ctx.stroke();
  }
}
function blend(a, b, t) {
  const v = [1, 3, 5].map((i) =>
    Math.round(
      parseInt(a.slice(i, i + 2), 16) * (1 - t) +
        parseInt(b.slice(i, i + 2), 16) * t,
    ),
  );
  return "rgb(" + v.join(",") + ")";
}
function drawBat(b) {
  const flap = Math.sin(time * 13 + b.phase) * 12,
    x = b.x,
    y = b.y;
  path(
    [
      [x - 5, y],
      [x - 19, y - 12 - flap],
      [x - 36, y - 5 - flap * 0.5],
      [x - 29, y + 7],
      [x - 18, y + 2],
      [x - 10, y + 10],
    ],
    "#39465f",
  );
  path(
    [
      [x + 5, y],
      [x + 19, y - 12 - flap],
      [x + 36, y - 5 - flap * 0.5],
      [x + 29, y + 7],
      [x + 18, y + 2],
      [x + 10, y + 10],
    ],
    "#39465f",
  );
  round(x - 9, y - 9, 18, 25, 0, "#202d49");
  path(
    [
      [x - 8, y - 7],
      [x - 7, y - 18],
      [x, y - 9],
      [x + 7, y - 18],
      [x + 8, y - 7],
    ],
    "#202d49",
  );
  round(x - 6, y - 3, 4, 4, 0, "#f6b878");
  round(x + 2, y - 3, 4, 4, 0, "#f6b878");
}
function drawPumpkin(it) {
  const x = it.x,
    y = it.y + (reduced ? 0 : Math.sin(time * 3 + it.x * 0.01) * 3);
  round(x - 15, y - 11, 30, 24, 3, "#c75324");
  round(x - 11, y - 15, 22, 30, 3, "#ed852f");
  round(x - 5, y - 16, 10, 32, 2, "#f39a40");
  round(x - 2, y - 22, 5, 8, 0, "#749258");
  path(
    [
      [x - 10, y - 3],
      [x - 5, y - 8],
      [x - 3, y - 2],
    ],
    "#ffed90",
  );
  path(
    [
      [x + 10, y - 3],
      [x + 5, y - 8],
      [x + 3, y - 2],
    ],
    "#ffed90",
  );
  path(
    [
      [x - 9, y + 4],
      [x - 4, y + 8],
      [x, y + 5],
      [x + 4, y + 8],
      [x + 9, y + 4],
      [x + 6, y + 11],
      [x - 6, y + 11],
    ],
    "#6d3027",
  );
}
function deadTree(x, y, h) {
  round(x - 4, y - h, 9, h, 0, "#302340");
  path(
    [
      [x, y - h * 0.6],
      [x - h * 0.3, y - h * 0.82],
      [x - h * 0.36, y - h * 0.69],
      [x - 3, y - h * 0.4],
    ],
    "#302340",
  );
  path(
    [
      [x + 3, y - h * 0.45],
      [x + h * 0.26, y - h * 0.65],
      [x + h * 0.31, y - h * 0.88],
      [x + h * 0.23, y - h * 0.71],
      [x + 2, y - h * 0.6],
    ],
    "#302340",
  );
  round(x - 5, y - h - 5, 12, 8, 0, "#302340");
}
function drawHalloween(dt) {
  const n = nightBlend;
  ctx.fillStyle = blend("#69496e", "#17152d", n);
  ctx.fillRect(0, -sceneOffset, W, viewHeight);
  for (let i = 0; i < 40; i++) {
    const sx = (((i * 137 + 37) % 1100) / 1100) * W,
      sy = 25 + ((i * 71) % 230);
    round(sx, sy, 2, 2, 0, "#d7bfa0");
  }
  ellipse(W * 0.82, 94, 42, 42, blend("#ffd69b", "#f2ddb9", n));
  round(W * 0.82 - 19, 79, 9, 7, 0, "#d4b591");
  round(W * 0.82 + 12, 105, 7, 6, 0, "#d4b591");
  for (let i = 0; i < 6; i++) {
    let x =
      ((((i * 230 - scroll * 0.09) % (W + 400)) + W + 400) % (W + 400)) - 130;
    ctx.globalAlpha = 0.16;
    cloud(x, 84 + (i % 3) * 43, 0.8);
    ctx.globalAlpha = 1;
  }
  for (let i = -1; i < 6; i++) {
    const x = i * 310 - ((scroll * 0.12) % 310);
    path(
      [
        [x - 110, 370],
        [x + 80, 164 + (i % 2) * 30],
        [x + 320, 370],
      ],
      blend("#493752", "#262540", n),
    );
  }
  const houseX =
    ((((W * 0.65 - scroll * 0.07) % (W + 400)) + W + 400) % (W + 400)) - 100;
  round(houseX, 255, 100, 100, 0, "#29233d");
  path(
    [
      [houseX - 15, 258],
      [houseX + 50, 206],
      [houseX + 115, 258],
    ],
    "#29233d",
  );
  round(houseX + 72, 208, 15, 50, 0, "#29233d");
  for (let i = 0; i < 3; i++)
    round(houseX + 14 + i * 29, 276, 12, 18, 0, "#d5a561");
  round(houseX + 44, 316, 19, 39, 0, "#141d31");
  ctx.fillStyle = blend("#584052", "#30283f", n);
  ctx.beginPath();
  ctx.moveTo(0, 389);
  ctx.quadraticCurveTo(W * 0.3, 330, W * 0.6, 383);
  ctx.quadraticCurveTo(W * 0.8, 350, W, 382);
  ctx.lineTo(W, viewHeight);
  ctx.lineTo(0, viewHeight);
  ctx.fill();
  for (let i = 0; i < 10; i++)
    deadTree(i * 140 - ((scroll * 0.25) % 140), 392, 63 + (i % 3) * 17);
  for (const p of platforms) {
    round(p.x, p.y, p.w, 53, 0, "#493544");
    round(p.x, p.y + 12, p.w, 10, 0, "#754c45");
    round(p.x - 3, p.y - 5, p.w + 6, 13, 0, "#b17a48");
    round(p.x - 3, p.y - 5, p.w + 6, 4, 0, "#e0a35c");
    for (let k = 24; k < p.w - 10; k += 39)
      round(p.x + k, p.y + 34, 15, 5, 0, "#342c40");
    if (p.w > 350) {
      deadTree(p.x + p.w - 65, p.y - 5, 78);
      round(p.x + 40, p.y - 30, 24, 28, 0, "#8b7c88");
      round(p.x + 43, p.y - 35, 18, 7, 0, "#8b7c88");
      round(p.x + 50, p.y - 25, 4, 15, 0, "#554457");
      round(p.x + 46, p.y - 21, 12, 4, 0, "#554457");
    }
  }
  for (const it of items) if (!it.taken) gift(it);
  for (const bat of flyers) drawBat(bat);
  santa();
  for (const f of snow) {
    if (!reduced) {
      f.y += f.v * dt * 0.65;
      f.x -= dt * (18 + Math.sin(time + f.r) * 12);
      if (f.y > viewHeight - sceneOffset) {
        f.y = -sceneOffset - 5;
        f.x = Math.random() * W;
      }
      if (f.x < 0) f.x = W;
    }
    const x = f.x % W;
    round(x, f.y, f.r * 2 + 2, f.r + 2, 0, f.r > 2 ? "#d8904f" : "#c16f50");
    round(x + f.r, f.y + f.r, 2, 4, 0, "#9c5948");
  }
}
function draw(dt) {
  if (selectedMode === "halloween") {
    drawHalloween(dt);
    return;
  }
  const n = nightBlend;
  ctx.fillStyle = blend("#b6e3e5", "#101d39", n);
  ctx.fillRect(0, -sceneOffset, W, viewHeight);
  if (n > 0) {
    ctx.globalAlpha = n;
    for (let i = 0; i < 55; i++) {
      const sx = (((i * 137 + 37) % 1100) / 1100) * W,
        sy = 25 + ((i * 71) % 230);
      round(sx, sy, i % 4 === 0 ? 4 : 2, i % 4 === 0 ? 4 : 2, 0, "#d9eaf7");
    }
    ctx.globalAlpha = 1;
  }
  ellipse(W * 0.82, 91, 38, 38, blend("#fff3bf", "#e0eaf6", n));
  if (n > 0) {
    ctx.globalAlpha = n;
    ellipse(W * 0.82 + 15, 80, 31, 31, "#101d39");
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < 7; i++) {
    let x =
      ((((i * 225 - scroll * 0.08) % (W + 400)) + W + 400) % (W + 400)) - 130;
    ctx.globalAlpha = 1 - n * 0.7;
    cloud(x, 80 + (i % 3) * 40, 0.6 + (i % 2) * 0.3);
    ctx.globalAlpha = 1;
  }
  for (let i = -1; i < 6; i++) {
    let x = i * 310 - ((scroll * 0.12) % 310);
    path(
      [
        [x - 100, 355],
        [x + 80, 132 + (i % 2) * 36],
        [x + 300, 355],
      ],
      blend("#8db9bc", "#263d5d", n),
    );
    path(
      [
        [x + 80, 132 + (i % 2) * 36],
        [x + 25, 200 + (i % 2) * 25],
        [x + 65, 183 + (i % 2) * 30],
        [x + 85, 209 + (i % 2) * 24],
        [x + 104, 186 + (i % 2) * 30],
        [x + 137, 209 + (i % 2) * 25],
      ],
      blend("#f6f8e9", "#8faacb", n),
    );
  }
  path(
    [
      [0, 370],
      [0, 330],
      [W * 0.25, 290],
      [W * 0.52, 340],
      [W * 0.75, 280],
      [W, 330],
      [W, 620],
      [0, 620],
    ],
    blend("#cce4da", "#284b64", n),
  );
  for (let i = 0; i < 13; i++) {
    let x = i * 112 - ((scroll * 0.25) % 112);
    pine(x, 383, 58 + (i % 3) * 17);
  }
  ctx.fillStyle = blend("#e7f1e5", "#31586e", n);
  ctx.beginPath();
  ctx.moveTo(0, 395);
  ctx.quadraticCurveTo(W * 0.25, 340, W * 0.5, 385);
  ctx.quadraticCurveTo(W * 0.75, 345, W, 382);
  ctx.lineTo(W, viewHeight);
  ctx.lineTo(0, viewHeight);
  ctx.fill();
  for (const p of platforms) {
    round(p.x, p.y, p.w, 53, 12, blend("#857d70", "#38465d", n));
    round(p.x, p.y + 12, p.w, 12, 4, blend("#a99c7c", "#53657a", n));
    for (let k = 20; k < p.w - 10; k += 36)
      round(p.x + k, p.y + 33, 14, 5, 2, blend("#6f7168", "#273a52", n));
    round(p.x - 3, p.y - 5, p.w + 6, 17, 8, blend("#fdfdf1", "#c3d9e9", n));
    for (let k = 30; k < p.w - 10; k += 75)
      round(p.x + k, p.y + 3, 13, 16, 6, blend("#fdfdf1", "#c3d9e9", n));
    if (p.w > 350) {
      pine(p.x + p.w - 65, p.y - 8, 67);
      round(p.x + 48, p.y - 38, 7, 33, 2, "#ae7160");
      round(p.x + 33, p.y - 44, 46, 19, 4, "#d56857");
      ctx.fillStyle = "#fff5d9";
      ctx.font = "12px Mojangles";
      path(
        [
          [p.x + 44, p.y - 37],
          [p.x + 57, p.y - 37],
          [p.x + 57, p.y - 41],
          [p.x + 64, p.y - 34],
          [p.x + 57, p.y - 27],
          [p.x + 57, p.y - 31],
          [p.x + 44, p.y - 31],
        ],
        "#fff5d9",
      );
    }
  }
  for (const it of items) if (!it.taken) gift(it);
  for (const bat of flyers) drawBat(bat);
  santa();
  for (const f of snow) {
    if (!reduced) {
      f.y += f.v * dt;
      f.x -= dt * 13;
      if (f.y > viewHeight - sceneOffset) {
        f.y = -sceneOffset - 5;
        f.x = Math.random() * W;
      }
      if (f.x < 0) f.x = W;
    }
    ellipse(f.x % W, f.y, f.r, f.r, "#ffffffd0");
  }
}
function update(dt) {
  time += dt;
  const d = difficulty(distance);
  speed = d.speed;
  nightBlend = Math.min(1, nightBlend + (d.night ? dt / 3 : 0));
  $("stageStatus").textContent =
    (d.night ? "NIGHT" : selectedMode === "halloween" ? "DUSK" : "DAY") +
    " · LEVEL " +
    d.level +
    (d.maxSpeed ? " · MAX SPEED" : "");
  if (d.night && !nightAnnounced) {
    nightAnnounced = true;
    milestoneTimer = 3.5;
    $("milestone").hidden = false;
    document.body.classList.add("night");
    tone(440, 0.3);
  }
  if (milestoneTimer > 0) {
    milestoneTimer -= dt;
    if (milestoneTimer <= 0) $("milestone").hidden = true;
  }
  let move = speed * dt;
  scroll += move;
  distance += move / 25;
  for (const p of platforms) p.x -= move;
  for (const it of items) it.x -= move;
  for (const bat of flyers) {
    bat.x -= move;
    bat.y = bat.baseY + Math.sin(time * 3 + bat.phase) * 7;
  }
  flyers = flyers.filter((b) => b.x > -100);
  platforms = platforms.filter((p) => p.x + p.w > -100);
  items = items.filter((it) => it.x > -100);
  extend();
  let old = player.y;
  player.vy += 1700 * dt;
  player.y += player.vy * dt;
  player.grounded = false;
  if (player.vy >= 0) {
    for (const p of platforms) {
      if (
        player.x + 13 > p.x &&
        player.x - 13 < p.x + p.w &&
        old <= p.y + 1 &&
        player.y >= p.y
      ) {
        player.y = p.y;
        player.vy = 0;
        player.grounded = true;
        break;
      }
    }
  }
  for (const it of items)
    if (
      !it.taken &&
      Math.abs(player.x - it.x) < 30 &&
      Math.abs(player.y - 47 - it.y) < 50
    ) {
      it.taken = true;
      gifts++;
      $("gifts").textContent = gifts;
      tone(990, 0.16);
    }
  $("score").textContent = Math.floor(distance);
  for (const bat of flyers) {
    if (
      Math.abs(player.x - bat.x) < 29 &&
      bat.y + 11 > player.y - 125 &&
      bat.y - 9 < player.y - 10
    ) {
      end();
      return;
    }
  }
  if (player.y > H + 130) end();
}
function launchGame() {
  if (bootPhase !== "welcome") return;
  playModeMusic("lobby");
  bootPhase = "loading";
  bootStarted = performance.now();
  $("launch").hidden = true;
  $("bootLoading").hidden = false;
  $("bootTitle").textContent = "Almost adventure time";
  $("bootSubtitle").textContent = "Warming up your runners...";
  $("bootScreen").classList.add("is-loading");
  $("loadingBar").focus();
}
function updateBoot(t) {
  if (bootPhase !== "loading") return;
  const progress = Math.min(1, Math.max(0, (t - bootStarted) / BOOT_DURATION)),
    percent = Math.floor(progress * 100);
  $("loadingFill").style.width = percent + "%";
  $("loadingPercent").textContent = percent + "%";
  $("loadingBar").setAttribute("aria-valuenow", String(percent));
  const stage = Math.min(3, Math.floor(progress * 4));
  if (stage !== bootStage) {
    bootStage = stage;
    $("loadingStatus").textContent = [
      "Packing your adventure...",
      "Waking up the runners...",
      "Preparing two worlds...",
      "Ready for your first jump!",
    ][stage];
  }
  const cv = $("loadingRunner"),
    cx = cv.getContext("2d"),
    item = characterData[selectedCharacter];
  cx.clearRect(0, 0, 110, 110);
  cx.imageSmoothingEnabled = false;
  if (item.ready)
    drawSprite(
      cx,
      item.image,
      reduced ? 0 : Math.floor(t / 90) % 8,
      55,
      105,
      102,
      item.runFrames,
    );
  if (progress >= 1) {
    bootPhase = "ready";
    $("bootScreen").hidden = true;
    document.body.classList.remove("boot-visible");
    $("overlay").inert = false;
    showCharacterPicker();
    document.querySelector("[data-mode]")?.focus();
  }
}
$("launch").onclick = launchGame;
function frame(t) {
  let dt = Math.min((t - last) / 1000 || 0, 0.03);
  last = t;
  if (state === "running") update(dt);
  draw(state === "paused" ? 0 : dt);
  drawPreviews(t);
  updateBoot(t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

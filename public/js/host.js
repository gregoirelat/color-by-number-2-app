// Vue hôte : pilote la partie (lobby -> questions -> reveal -> scoreboard -> podium).
// Gère la reconnexion de l'hôte (jeton en sessionStorage) après une coupure.

const SHAPES = ["▲", "◆", "●", "■"];
const socket = io();
const el = (id) => document.getElementById(id);

const sections = ["lobby", "question", "reveal", "scoreboard", "end"];
function show(name) {
  sections.forEach((s) => el(s).classList.toggle("hidden", s !== name));
}

const HOST_KEY = "quizparty:host";
function saveHostSession(pin, token) {
  try {
    sessionStorage.setItem(HOST_KEY, JSON.stringify({ pin, token }));
  } catch {}
}
function loadHostSession() {
  try {
    return JSON.parse(sessionStorage.getItem(HOST_KEY));
  } catch {
    return null;
  }
}

let quiz = null;
try {
  quiz = JSON.parse(sessionStorage.getItem("quizparty:quiz"));
} catch {}

el("siteUrl").textContent = window.location.host;

async function setupLobby(pin, title) {
  el("pin").textContent = pin;
  el("lobbyTitle").textContent = title;
  document.title = `PIN ${pin} — Quiz Party`;
  try {
    const r = await fetch(`/api/qr?pin=${pin}`);
    const data = await r.json();
    el("qr").src = data.dataUrl;
    el("joinUrl").textContent = data.joinUrl;
  } catch {}
}

function createGame() {
  if (!quiz || !quiz.questions?.length) {
    window.location.href = "/";
    return;
  }
  socket.emit("host:create", quiz, (res) => {
    saveHostSession(res.pin, res.hostToken);
    setupLobby(res.pin, res.title);
  });
}

// À chaque (re)connexion : reconnexion si session existante, sinon création.
socket.on("connect", () => {
  const hs = loadHostSession();
  if (hs && hs.pin && hs.token) {
    socket.emit("host:rejoin", { pin: hs.pin, token: hs.token }, (res) => {
      if (res && res.ok) {
        setupLobby(res.pin, res.title);
        // Le serveur renvoie ensuite l'état courant (question/reveal/etc.).
      } else {
        createGame();
      }
    });
  } else {
    createGame();
  }
});

socket.on("lobby:update", ({ players, count }) => {
  el("playerCount").textContent = count;
  const wrap = el("players");
  wrap.innerHTML = "";
  players.forEach((p) => {
    const chip = document.createElement("div");
    chip.className = "player-chip";
    chip.textContent = p.name;
    chip.title = "Expulser " + p.name;
    chip.onclick = () => {
      if (confirm(`Expulser ${p.name} ?`)) socket.emit("host:kick", { playerId: p.id });
    };
    wrap.appendChild(chip);
  });
  const has = count > 0;
  el("btnStart").disabled = !has;
  el("startHint").textContent = has ? "Prêt à démarrer !" : "En attente de joueurs…";
});

el("btnStart").onclick = () => socket.emit("host:next");
el("btnNext").onclick = () => socket.emit("host:next");
el("btnSkip").onclick = () => socket.emit("host:next");
el("btnScoreboard").onclick = () => socket.emit("host:scoreboard");

function setImage(imgEl, url) {
  if (url) {
    imgEl.src = url;
    imgEl.classList.remove("hidden");
  } else {
    imgEl.removeAttribute("src");
    imgEl.classList.add("hidden");
  }
}

let timerInterval = null;
socket.on("game:question", (q) => {
  show("question");
  el("qIndex").textContent = q.index + 1;
  el("qTotal").textContent = q.total;
  el("qText").textContent = q.text;
  el("respCount").textContent = "0";
  setImage(el("qImage"), q.image);

  const wrap = el("answers");
  wrap.innerHTML = "";
  const labels = q.type === "truefalse" ? ["Vrai", "Faux"] : SHAPES;
  const images = q.answerImages || [];
  q.answers.forEach((a, i) => {
    const d = document.createElement("div");
    d.className = `answer a${i}`;
    d.innerHTML = `
      <span class="shape">${labels[i]}</span>
      ${images[i] ? `<img class="answer-img" src="${escapeAttr(images[i])}" alt="" />` : ""}
      <span>${escapeHtml(a)}</span>`;
    wrap.appendChild(d);
  });

  clearInterval(timerInterval);
  const endsAt = q.startedAt + q.time * 1000;
  const tick = () => {
    const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    el("timer").textContent = left;
    if (left <= 0) clearInterval(timerInterval);
  };
  tick();
  timerInterval = setInterval(tick, 250);
});

socket.on("game:answerCount", ({ responded }) => {
  el("respCount").textContent = responded;
});

socket.on("game:reveal", (r) => {
  clearInterval(timerInterval);
  show("reveal");
  el("revealText").textContent = r.text;
  setImage(el("revealImage"), r.image);
  const wrap = el("revealAnswers");
  wrap.innerHTML = "";
  const labels = r.answers.length === 2 && r.answers[0] === "Vrai" ? ["Vrai", "Faux"] : SHAPES;
  const images = r.answerImages || [];
  r.answers.forEach((a, i) => {
    const d = document.createElement("div");
    const isCorrect = i === r.correctIndex;
    d.className = `answer a${i} ${isCorrect ? "correct" : "dim"}`;
    d.innerHTML = `
      <span class="shape">${labels[i]}</span>
      ${images[i] ? `<img class="answer-img" src="${escapeAttr(images[i])}" alt="" />` : ""}
      <span>${escapeHtml(a)} ${isCorrect ? "✔️" : ""}</span>
      <span class="count">${r.distribution[i]}</span>`;
    wrap.appendChild(d);
  });
});

socket.on("game:scoreboard", ({ leaderboard, isLast }) => {
  show("scoreboard");
  renderLeaderboard(el("lbList"), leaderboard, true);
  el("btnNext").textContent = isLast ? "Voir le podium 🏁" : "Question suivante";
});

socket.on("game:end", ({ leaderboard }) => {
  show("end");
  renderPodium(leaderboard);
  renderLeaderboard(el("finalList"), leaderboard, false);
});

function renderLeaderboard(container, list, showGain) {
  container.innerHTML = "";
  list.forEach((p) => {
    const row = document.createElement("div");
    row.className = "lb-row";
    row.innerHTML = `
      <span class="lb-rank">${p.rank}</span>
      <span class="lb-name">${escapeHtml(p.name)}</span>
      ${showGain && p.lastPoints ? `<span class="lb-gain">+${p.lastPoints}</span>` : ""}
      <span class="lb-score">${p.score}</span>`;
    container.appendChild(row);
  });
}

function renderPodium(list) {
  const order = [1, 0, 2];
  const podium = el("podium");
  podium.innerHTML = "";
  order.forEach((idx) => {
    const p = list[idx];
    if (!p) return;
    const col = document.createElement("div");
    col.className = `podium-col podium-${p.rank}`;
    col.innerHTML = `
      <div style="font-weight:800">${escapeHtml(p.name)}</div>
      <div class="lb-score">${p.score}</div>
      <div class="podium-bar">${p.rank}</div>`;
    podium.appendChild(col);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Pour insérer une URL dans un attribut src en toute sécurité.
function escapeAttr(s) {
  return String(s).replace(/[&"'<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "'": "&#39;", "<": "&lt;", ">": "&gt;" })[c]);
}

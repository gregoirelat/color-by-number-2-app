// Vue hôte : pilote la partie (lobby -> questions -> reveal -> scoreboard -> podium).

const SHAPES = ["▲", "◆", "●", "■"];
const socket = io();
const el = (id) => document.getElementById(id);

const sections = ["lobby", "question", "reveal", "scoreboard", "end"];
function show(name) {
  sections.forEach((s) => el(s).classList.toggle("hidden", s !== name));
}

// Récupère le quiz préparé par l'éditeur.
let quiz;
try {
  quiz = JSON.parse(sessionStorage.getItem("quizparty:quiz"));
} catch {
  quiz = null;
}
if (!quiz || !quiz.questions?.length) {
  // Pas de quiz -> retour accueil.
  window.location.href = "/";
}

el("siteUrl").textContent = window.location.host;

// Crée la partie côté serveur.
socket.on("connect", () => {
  socket.emit("host:create", quiz, async (res) => {
    el("pin").textContent = res.pin;
    el("lobbyTitle").textContent = res.title;
    document.title = `PIN ${res.pin} — Quiz Party`;
    // QR code.
    try {
      const r = await fetch(`/api/qr?pin=${res.pin}`);
      const data = await r.json();
      el("qr").src = data.dataUrl;
      el("joinUrl").textContent = data.joinUrl;
    } catch {}
  });
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

// --- Question ---
let timerInterval = null;
socket.on("game:question", (q) => {
  show("question");
  el("qIndex").textContent = q.index + 1;
  el("qTotal").textContent = q.total;
  el("qText").textContent = q.text;
  el("respCount").textContent = "0";

  const wrap = el("answers");
  wrap.innerHTML = "";
  q.answers.forEach((a, i) => {
    const d = document.createElement("div");
    d.className = `answer a${i}`;
    d.innerHTML = `<span class="shape">${SHAPES[i]}</span><span>${escapeHtml(a)}</span>`;
    wrap.appendChild(d);
  });

  // Chrono affiché.
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

// --- Reveal ---
socket.on("game:reveal", (r) => {
  clearInterval(timerInterval);
  show("reveal");
  el("revealText").textContent = r.text;
  const max = Math.max(1, ...r.distribution);
  const wrap = el("revealAnswers");
  wrap.innerHTML = "";
  r.answers.forEach((a, i) => {
    const d = document.createElement("div");
    const isCorrect = i === r.correctIndex;
    d.className = `answer a${i} ${isCorrect ? "correct" : "dim"}`;
    d.innerHTML = `
      <span class="shape">${SHAPES[i]}</span>
      <span>${escapeHtml(a)} ${isCorrect ? "✔️" : ""}</span>
      <span class="count">${r.distribution[i]}</span>`;
    wrap.appendChild(d);
  });
});

// --- Scoreboard ---
socket.on("game:scoreboard", ({ leaderboard, isLast }) => {
  show("scoreboard");
  renderLeaderboard(el("lbList"), leaderboard, true);
  el("btnNext").textContent = isLast ? "Voir le podium 🏁" : "Question suivante";
});

// --- Fin ---
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
  const order = [1, 0, 2]; // 2e, 1er, 3e
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

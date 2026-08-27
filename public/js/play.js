// Vue joueur (mobile) : rejoint via PIN (pré-rempli par le QR code), répond,
// voit ses résultats, et se reconnecte automatiquement en cas de coupure réseau.

const SHAPES = ["▲", "◆", "●", "■"];
const socket = io();
const el = (id) => document.getElementById(id);

const sections = ["join", "wait", "answer", "answered", "result", "final"];
function show(name) {
  sections.forEach((s) => el(s).classList.toggle("hidden", s !== name));
}

const SESSION_KEY = "quizparty:session";
function saveSession(pin, token, name) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ pin, token, name }));
  } catch {}
}
function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}
function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

// Pré-remplit le PIN depuis l'URL (?pin=...) fournie par le QR code.
const params = new URLSearchParams(window.location.search);
if (params.get("pin")) el("pinInput").value = params.get("pin");

let timerInterval = null;
let myName = "";

// Tente une reconnexion automatique à chaque (re)connexion socket.
socket.on("connect", () => {
  const sess = loadSession();
  if (sess && sess.pin && sess.token) {
    socket.emit("player:rejoin", { pin: sess.pin, token: sess.token }, (res) => {
      if (res && res.ok) {
        myName = res.name;
        el("waitName").textContent = res.name;
        // L'état exact (question/résultat) est renvoyé par le serveur juste après.
        if (res.state === "lobby") show("wait");
      } else {
        // Session invalide -> on l'oublie et on montre l'écran de connexion.
        clearSession();
        show("join");
      }
    });
  }
});

el("btnJoin").onclick = doJoin;
el("nameInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doJoin();
});

function doJoin() {
  const pin = el("pinInput").value.trim();
  const name = el("nameInput").value.trim();
  if (!/^\d{4,8}$/.test(pin)) {
    el("joinStatus").textContent = "⚠️ PIN invalide.";
    return;
  }
  if (!name) {
    el("joinStatus").textContent = "⚠️ Entre un pseudo.";
    return;
  }
  el("btnJoin").disabled = true;
  el("joinStatus").textContent = "Connexion…";
  socket.emit("player:join", { pin, name }, (res) => {
    el("btnJoin").disabled = false;
    if (res.error) {
      el("joinStatus").textContent = "⚠️ " + res.error;
      return;
    }
    myName = res.name;
    saveSession(res.pin, res.token, res.name);
    el("waitName").textContent = res.name;
    show("wait");
  });
}

// --- Question : afficher les gros boutons ---
socket.on("game:question", (q) => {
  show("answer");
  el("pIndex").textContent = q.index + 1;
  el("pTotal").textContent = q.total;

  const wrap = el("pAnswers");
  wrap.classList.toggle("tf", q.type === "truefalse");
  wrap.innerHTML = "";
  const labels = q.type === "truefalse" ? ["Vrai", "Faux"] : SHAPES;
  for (let i = 0; i < q.answersCount; i++) {
    const btn = document.createElement("button");
    btn.className = `a${i}`;
    btn.textContent = labels[i];
    btn.onclick = () => socket.emit("player:answer", { answerIndex: i });
    wrap.appendChild(btn);
  }

  clearInterval(timerInterval);
  const endsAt = q.startedAt + q.time * 1000;
  const tick = () => {
    const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    el("pTimer").textContent = left;
    if (left <= 0) clearInterval(timerInterval);
  };
  tick();
  timerInterval = setInterval(tick, 250);
});

socket.on("game:answered", () => {
  clearInterval(timerInterval);
  show("answered");
});

// --- Résultat individuel ---
socket.on("game:result", (r) => {
  clearInterval(timerInterval);
  show("result");
  const banner = el("resultBanner");
  if (!r.answered) {
    banner.className = "result-banner result-wrong";
    banner.textContent = "⏱️ Trop tard !";
  } else if (r.correct) {
    banner.className = "result-banner result-correct";
    banner.textContent = "✅ Correct !";
  } else {
    banner.className = "result-banner result-wrong";
    banner.textContent = "❌ Raté";
  }
  el("resultInfo").innerHTML = `
    ${r.pointsEarned ? `<div style="font-size:1.6rem;font-weight:800">+${r.pointsEarned} pts</div>` : ""}
    <div class="status-line">Score : <strong>${r.totalScore}</strong> — Rang ${r.rank}/${r.totalPlayers}
    ${r.streak > 1 ? ` 🔥 série de ${r.streak}` : ""}</div>`;
});

// --- Fin ---
socket.on("game:end", (r) => {
  show("final");
  clearSession();
  el("finalInfo").innerHTML = `
    <div style="font-size:2rem;font-weight:800">${medal(r.rank)} Rang ${r.rank ?? "-"}/${r.totalPlayers}</div>
    <div class="status-line">Score final : <strong>${r.score}</strong></div>`;
});

function medal(rank) {
  return { 1: "🥇", 2: "🥈", 3: "🥉" }[rank] || "🎮";
}

socket.on("game:kicked", () => {
  clearSession();
  alert("Tu as été expulsé·e de la partie.");
  window.location.href = "/play";
});
socket.on("game:closed", () => {
  clearSession();
  show("join");
  el("joinStatus").textContent = "La partie a été fermée par l'hôte.";
});
socket.on("disconnect", () => {
  clearInterval(timerInterval);
});

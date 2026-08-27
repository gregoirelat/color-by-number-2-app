// Vue joueur (mobile) : rejoint via PIN (pré-rempli par le QR code), répond, voit ses résultats.

const SHAPES = ["▲", "◆", "●", "■"];
const socket = io();
const el = (id) => document.getElementById(id);

const sections = ["join", "wait", "answer", "answered", "result", "final"];
function show(name) {
  sections.forEach((s) => el(s).classList.toggle("hidden", s !== name));
}

// Pré-remplit le PIN depuis l'URL (?pin=...) fournie par le QR code.
const params = new URLSearchParams(window.location.search);
if (params.get("pin")) el("pinInput").value = params.get("pin");

let timerInterval = null;

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
  wrap.innerHTML = "";
  for (let i = 0; i < q.answersCount; i++) {
    const btn = document.createElement("button");
    btn.className = `a${i}`;
    btn.textContent = SHAPES[i];
    btn.onclick = () => {
      socket.emit("player:answer", { answerIndex: i });
    };
    wrap.appendChild(btn);
  }

  // Chrono.
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
  el("finalInfo").innerHTML = `
    <div style="font-size:2rem;font-weight:800">${medal(r.rank)} Rang ${r.rank ?? "-"}/${r.totalPlayers}</div>
    <div class="status-line">Score final : <strong>${r.score}</strong></div>`;
});

function medal(rank) {
  return { 1: "🥇", 2: "🥈", 3: "🥉" }[rank] || "🎮";
}

// --- Événements divers ---
socket.on("game:kicked", () => {
  alert("Tu as été expulsé·e de la partie.");
  window.location.href = "/play";
});
socket.on("game:closed", () => {
  show("join");
  el("joinStatus").textContent = "La partie a été fermée par l'hôte.";
});
socket.on("disconnect", () => {
  clearInterval(timerInterval);
});

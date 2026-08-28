// Éditeur de quiz : construit un objet quiz, gère une bibliothèque locale
// (localStorage), puis passe le quiz choisi à la page hôte via sessionStorage.

const SHAPES = ["▲", "◆", "●", "■"];
const SWATCHES = ["#e21b3c", "#1368ce", "#d89e00", "#26890c"];
const STORAGE_KEY = "quizparty:quiz";
const LIBRARY_KEY = "quizparty:library";

const SAMPLE = {
  title: "Culture générale express",
  questions: [
    { type: "quiz", text: "Quelle est la capitale de l'Australie ?", answers: ["Sydney", "Canberra", "Melbourne", "Perth"], correctIndex: 1, time: 20, image: "" },
    { type: "quiz", text: "Combien de côtés a un hexagone ?", answers: ["5", "6", "7", "8"], correctIndex: 1, time: 15, image: "" },
    { type: "quiz", text: "Qui a peint la Joconde ?", answers: ["Van Gogh", "Picasso", "Léonard de Vinci", "Monet"], correctIndex: 2, time: 20, image: "" },
    { type: "truefalse", text: "La Grande Muraille de Chine est visible à l'œil nu depuis la Lune.", answers: ["Vrai", "Faux"], correctIndex: 1, time: 15, image: "" },
    { type: "quiz", text: "En quelle année a eu lieu le premier pas sur la Lune ?", answers: ["1965", "1969", "1972", "1958"], correctIndex: 1, time: 20, image: "" },
  ],
};

let questions = [];

const el = (id) => document.getElementById(id);

function newQuestion(type = "quiz") {
  return type === "truefalse"
    ? { type: "truefalse", text: "", answers: ["Vrai", "Faux"], answerImages: ["", ""], correctIndex: 0, time: 20, image: "" }
    : { type: "quiz", text: "", answers: ["", "", "", ""], answerImages: ["", "", "", ""], correctIndex: 0, time: 20, image: "" };
}

// ---- Rendu des questions ----

function render() {
  const wrap = el("questions");
  wrap.innerHTML = "";
  questions.forEach((q, qi) => {
    const block = document.createElement("div");
    block.className = "q-block";
    const isTF = q.type === "truefalse";
    block.innerHTML = `
      <div class="q-meta">
        <strong>Question ${qi + 1}</strong>
        <select data-type="${qi}" title="Type de question">
          <option value="quiz" ${!isTF ? "selected" : ""}>QCM (4 réponses)</option>
          <option value="truefalse" ${isTF ? "selected" : ""}>Vrai / Faux</option>
        </select>
        <span style="flex:1"></span>
        <label>Temps (s) <input type="number" min="5" max="120" value="${q.time}" data-time="${qi}" /></label>
        <button class="btn-ghost" data-del="${qi}" style="padding:0.4rem 0.8rem">🗑️</button>
      </div>
      <input placeholder="Énoncé de la question" value="${escapeHtml(q.text)}" data-text="${qi}" />
      <input placeholder="URL d'une image (optionnel, https://…)" value="${escapeHtml(q.image || "")}" data-image="${qi}" />
      <div class="q-answers">
        ${q.answers
          .map(
            (a, ai) => `
          <div class="q-answer-row">
            <span class="swatch" style="background:${SWATCHES[ai]}"></span>
            <input type="radio" name="correct-${qi}" ${q.correctIndex === ai ? "checked" : ""} data-correct="${qi}-${ai}" title="Bonne réponse" />
            <div class="q-answer-inputs">
              <input placeholder="Réponse ${SHAPES[ai]}" value="${escapeHtml(a)}" data-answer="${qi}-${ai}" ${isTF ? "disabled" : ""} />
              <input class="ans-img" placeholder="URL image de la réponse (option.)" value="${escapeHtml((q.answerImages && q.answerImages[ai]) || "")}" data-answerimg="${qi}-${ai}" ${isTF ? "disabled" : ""} />
            </div>
          </div>`
          )
          .join("")}
      </div>
      <p class="small">Coche le bouton radio de la bonne réponse.</p>
    `;
    wrap.appendChild(block);
  });
  attachHandlers();
}

function attachHandlers() {
  document.querySelectorAll("[data-text]").forEach((inp) => {
    inp.oninput = (e) => (questions[+e.target.dataset.text].text = e.target.value);
  });
  document.querySelectorAll("[data-image]").forEach((inp) => {
    inp.oninput = (e) => (questions[+e.target.dataset.image].image = e.target.value.trim());
  });
  document.querySelectorAll("[data-time]").forEach((inp) => {
    inp.oninput = (e) => (questions[+e.target.dataset.time].time = +e.target.value);
  });
  document.querySelectorAll("[data-answer]").forEach((inp) => {
    inp.oninput = (e) => {
      const [qi, ai] = e.target.dataset.answer.split("-").map(Number);
      questions[qi].answers[ai] = e.target.value;
    };
  });
  document.querySelectorAll("[data-answerimg]").forEach((inp) => {
    inp.oninput = (e) => {
      const [qi, ai] = e.target.dataset.answerimg.split("-").map(Number);
      if (!questions[qi].answerImages) questions[qi].answerImages = [];
      questions[qi].answerImages[ai] = e.target.value.trim();
    };
  });
  document.querySelectorAll("[data-correct]").forEach((inp) => {
    inp.onchange = (e) => {
      const [qi, ai] = e.target.dataset.correct.split("-").map(Number);
      questions[qi].correctIndex = ai;
    };
  });
  document.querySelectorAll("[data-type]").forEach((sel) => {
    sel.onchange = (e) => {
      const qi = +e.target.dataset.type;
      const cur = questions[qi];
      const next = newQuestion(e.target.value);
      next.text = cur.text;
      next.time = cur.time;
      next.image = cur.image;
      if (e.target.value === "quiz" && cur.type === "quiz") {
        next.answers = cur.answers;
        next.answerImages = cur.answerImages || ["", "", "", ""];
      }
      questions[qi] = next;
      render();
    };
  });
  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = (e) => {
      questions.splice(+e.target.dataset.del, 1);
      if (questions.length === 0) questions.push(newQuestion());
      render();
    };
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ---- Validation ----

function validate() {
  const title = el("quizTitle").value.trim();
  if (!title) return "Donne un titre au quiz.";
  const isUrl = (u) => !u || /^https?:\/\//i.test(u);
  const clean = questions
    .map((q) => {
      const isTF = q.type === "truefalse";
      const answers = (isTF ? ["Vrai", "Faux"] : q.answers).map((a) => a.trim());
      const answerImages = (isTF ? ["", ""] : q.answerImages || []).map((u) => (u || "").trim());
      // aligne la longueur des images sur celle des réponses
      while (answerImages.length < answers.length) answerImages.push("");
      return {
        type: isTF ? "truefalse" : "quiz",
        text: q.text.trim(),
        answers,
        answerImages: answerImages.slice(0, answers.length),
        correctIndex: q.correctIndex,
        time: q.time,
        image: (q.image || "").trim(),
      };
    })
    // une réponse compte si elle a du texte OU une image
    .filter((q) => q.text && q.answers.filter((t, i) => t || q.answerImages[i]).length >= 2);
  if (clean.length === 0) return "Ajoute au moins une question valide (énoncé + 2 réponses avec texte ou image).";
  for (const q of clean) {
    if (!q.answers[q.correctIndex] && !q.answerImages[q.correctIndex])
      return `La bonne réponse de « ${q.text} » est vide (ni texte ni image).`;
    if (!isUrl(q.image)) return `L'URL d'image de « ${q.text} » doit commencer par http(s)://.`;
    for (let i = 0; i < q.answerImages.length; i++) {
      if (!isUrl(q.answerImages[i])) return `Une URL d'image de réponse de « ${q.text} » doit commencer par http(s)://.`;
    }
  }
  return { title, questions: clean };
}

// ---- Bibliothèque (localStorage) ----

function loadLibrary() {
  try {
    return JSON.parse(localStorage.getItem(LIBRARY_KEY)) || [];
  } catch {
    return [];
  }
}
function saveLibrary(lib) {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
  } catch {}
}

function renderLibrary() {
  const lib = loadLibrary();
  const wrap = el("library");
  wrap.innerHTML = "";
  el("libEmpty").style.display = lib.length ? "none" : "block";
  lib.forEach((quiz) => {
    const chip = document.createElement("div");
    chip.className = "player-chip";
    chip.style.cursor = "default";
    chip.innerHTML = `<span data-load="${quiz.id}" style="cursor:pointer">${escapeHtml(quiz.title)} (${quiz.questions.length})</span>
      <span data-remove="${quiz.id}" title="Supprimer" style="cursor:pointer;margin-left:0.5rem">✕</span>`;
    wrap.appendChild(chip);
  });
  wrap.querySelectorAll("[data-load]").forEach((n) => {
    n.onclick = () => {
      const quiz = loadLibrary().find((q) => q.id === n.dataset.load);
      if (quiz) {
        el("quizTitle").value = quiz.title;
        questions = JSON.parse(JSON.stringify(quiz.questions));
        render();
        toast("Quiz chargé");
      }
    };
  });
  wrap.querySelectorAll("[data-remove]").forEach((n) => {
    n.onclick = () => {
      saveLibrary(loadLibrary().filter((q) => q.id !== n.dataset.remove));
      renderLibrary();
    };
  });
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1600);
}

// ---- Événements page ----

el("btnHostMode").onclick = () => {
  el("home").classList.add("hidden");
  el("editor").classList.remove("hidden");
  if (questions.length === 0) {
    questions = JSON.parse(JSON.stringify(SAMPLE.questions));
    el("quizTitle").value = SAMPLE.title;
  }
  render();
  renderLibrary();
};

el("btnAddQuestion").onclick = () => {
  questions.push(newQuestion());
  render();
  window.scrollTo(0, document.body.scrollHeight);
};

el("btnLoadSample").onclick = () => {
  questions = JSON.parse(JSON.stringify(SAMPLE.questions));
  el("quizTitle").value = SAMPLE.title;
  render();
};

el("btnSaveQuiz").onclick = () => {
  const res = validate();
  if (typeof res === "string") {
    el("editorStatus").textContent = "⚠️ " + res;
    return;
  }
  const lib = loadLibrary();
  const existing = lib.find((q) => q.title.toLowerCase() === res.title.toLowerCase());
  if (existing) {
    existing.questions = res.questions;
  } else {
    lib.push({ id: String(Date.now()), title: res.title, questions: res.questions });
  }
  saveLibrary(lib);
  renderLibrary();
  toast("💾 Quiz enregistré");
};

el("btnLaunch").onclick = () => {
  const res = validate();
  if (typeof res === "string") {
    el("editorStatus").textContent = "⚠️ " + res;
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(res));
  // Nouvelle partie -> on efface toute ancienne session hôte.
  try {
    sessionStorage.removeItem("quizparty:host");
  } catch {}
  window.location.href = "/host";
};

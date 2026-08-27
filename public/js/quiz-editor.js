// Éditeur de quiz : construit un objet quiz puis le passe à la page hôte via sessionStorage.

const SHAPES = ["▲", "◆", "●", "■"];
const SWATCHES = ["#e21b3c", "#1368ce", "#d89e00", "#26890c"];
const STORAGE_KEY = "quizparty:quiz";

const SAMPLE = {
  title: "Culture générale express",
  questions: [
    {
      text: "Quelle est la capitale de l'Australie ?",
      answers: ["Sydney", "Canberra", "Melbourne", "Perth"],
      correctIndex: 1,
      time: 20,
    },
    {
      text: "Combien de côtés a un hexagone ?",
      answers: ["5", "6", "7", "8"],
      correctIndex: 1,
      time: 15,
    },
    {
      text: "Qui a peint la Joconde ?",
      answers: ["Van Gogh", "Picasso", "Léonard de Vinci", "Monet"],
      correctIndex: 2,
      time: 20,
    },
    {
      text: "Quel est l'élément chimique de symbole O ?",
      answers: ["Or", "Oxygène", "Osmium", "Ozone"],
      correctIndex: 1,
      time: 15,
    },
    {
      text: "En quelle année a eu lieu le premier pas sur la Lune ?",
      answers: ["1965", "1969", "1972", "1958"],
      correctIndex: 1,
      time: 20,
    },
  ],
};

let questions = [];

const el = (id) => document.getElementById(id);

function newQuestion() {
  return { text: "", answers: ["", "", "", ""], correctIndex: 0, time: 20 };
}

function render() {
  const wrap = el("questions");
  wrap.innerHTML = "";
  questions.forEach((q, qi) => {
    const block = document.createElement("div");
    block.className = "q-block";
    block.innerHTML = `
      <div class="q-meta">
        <strong>Question ${qi + 1}</strong>
        <span style="flex:1"></span>
        <label>Temps (s) <input type="number" min="5" max="120" value="${q.time}" data-time="${qi}" /></label>
        <button class="btn-ghost" data-del="${qi}" style="padding:0.4rem 0.8rem">🗑️</button>
      </div>
      <input placeholder="Énoncé de la question" value="${escapeHtml(q.text)}" data-text="${qi}" />
      <div class="q-answers">
        ${q.answers
          .map(
            (a, ai) => `
          <div class="q-answer-row">
            <span class="swatch" style="background:${SWATCHES[ai]}">${""}</span>
            <input type="radio" name="correct-${qi}" ${q.correctIndex === ai ? "checked" : ""} data-correct="${qi}-${ai}" title="Bonne réponse" />
            <input placeholder="Réponse ${SHAPES[ai]}" value="${escapeHtml(a)}" data-answer="${qi}-${ai}" />
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
  document.querySelectorAll("[data-time]").forEach((inp) => {
    inp.oninput = (e) => (questions[+e.target.dataset.time].time = +e.target.value);
  });
  document.querySelectorAll("[data-answer]").forEach((inp) => {
    inp.oninput = (e) => {
      const [qi, ai] = e.target.dataset.answer.split("-").map(Number);
      questions[qi].answers[ai] = e.target.value;
    };
  });
  document.querySelectorAll("[data-correct]").forEach((inp) => {
    inp.onchange = (e) => {
      const [qi, ai] = e.target.dataset.correct.split("-").map(Number);
      questions[qi].correctIndex = ai;
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

function validate() {
  const title = el("quizTitle").value.trim();
  if (!title) return "Donne un titre au quiz.";
  const clean = questions
    .map((q) => ({
      text: q.text.trim(),
      answers: q.answers.map((a) => a.trim()),
      correctIndex: q.correctIndex,
      time: q.time,
    }))
    .filter((q) => q.text && q.answers.filter(Boolean).length >= 2);
  if (clean.length === 0) return "Ajoute au moins une question valide (énoncé + 2 réponses).";
  for (const q of clean) {
    if (!q.answers[q.correctIndex]) return `La bonne réponse de « ${q.text} » est vide.`;
  }
  return { title, questions: clean };
}

// --- Événements page ---

el("btnHostMode").onclick = () => {
  el("home").classList.add("hidden");
  el("editor").classList.remove("hidden");
  if (questions.length === 0) {
    questions = JSON.parse(JSON.stringify(SAMPLE.questions));
    el("quizTitle").value = SAMPLE.title;
  }
  render();
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

el("btnLaunch").onclick = () => {
  const res = validate();
  if (typeof res === "string") {
    el("editorStatus").textContent = "⚠️ " + res;
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(res));
  window.location.href = "/host";
};

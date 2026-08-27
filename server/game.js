// Logique de jeu — indépendante du transport (Socket.IO).
// Un GameManager détient toutes les parties en mémoire, indexées par PIN.

const PIN_LENGTH = 6;
const MAX_PLAYERS = 300; // marge confortable au-dessus de la centaine visée

// Points max par question (comme Kahoot : ~1000, modulé par la vitesse).
const MAX_POINTS = 1000;

function generatePin(existing) {
  let pin;
  do {
    pin = String(Math.floor(Math.random() * 10 ** PIN_LENGTH)).padStart(PIN_LENGTH, "0");
  } while (existing.has(pin));
  return pin;
}

// États d'une partie.
export const GameState = {
  LOBBY: "lobby",
  QUESTION: "question", // question affichée, réponses ouvertes
  REVEAL: "reveal", // bonne réponse + stats affichées
  SCOREBOARD: "scoreboard", // classement intermédiaire
  ENDED: "ended", // podium final
};

class Game {
  constructor(pin, hostSocketId, quiz) {
    this.pin = pin;
    this.hostSocketId = hostSocketId;
    this.quiz = quiz; // { title, questions: [{ text, answers[], correctIndex, time, image? }] }
    this.state = GameState.LOBBY;
    this.players = new Map(); // socketId -> { id, name, score, streak, answered, lastPoints }
    this.currentIndex = -1;
    this.questionStartedAt = 0;
    this.answersThisRound = new Map(); // socketId -> { answerIndex, timeMs }
    this.timer = null;
    this.createdAt = Date.now();
  }

  get currentQuestion() {
    if (this.currentIndex < 0 || this.currentIndex >= this.quiz.questions.length) return null;
    return this.quiz.questions[this.currentIndex];
  }

  get isLast() {
    return this.currentIndex >= this.quiz.questions.length - 1;
  }

  addPlayer(socketId, name) {
    if (this.players.size >= MAX_PLAYERS) {
      return { error: "Partie complète." };
    }
    const trimmed = String(name || "").trim().slice(0, 20);
    if (!trimmed) return { error: "Pseudo invalide." };
    const taken = [...this.players.values()].some(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (taken) return { error: "Ce pseudo est déjà pris." };

    const player = { id: socketId, name: trimmed, score: 0, streak: 0, answered: false, lastPoints: 0 };
    this.players.set(socketId, player);
    return { player };
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    this.answersThisRound.delete(socketId);
  }

  playerList() {
    return [...this.players.values()].map((p) => ({ id: p.id, name: p.name, score: p.score }));
  }

  // Classement décroissant.
  leaderboard(limit) {
    const sorted = [...this.players.values()].sort((a, b) => b.score - a.score);
    const arr = sorted.map((p, i) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      lastPoints: p.lastPoints,
      rank: i + 1,
    }));
    return typeof limit === "number" ? arr.slice(0, limit) : arr;
  }

  startQuestion() {
    this.currentIndex += 1;
    this.state = GameState.QUESTION;
    this.questionStartedAt = Date.now();
    this.answersThisRound = new Map();
    for (const p of this.players.values()) {
      p.answered = false;
      p.lastPoints = 0;
    }
  }

  // Enregistre la réponse d'un joueur. Retourne true si acceptée.
  submitAnswer(socketId, answerIndex) {
    if (this.state !== GameState.QUESTION) return false;
    const player = this.players.get(socketId);
    if (!player || player.answered) return false;
    const q = this.currentQuestion;
    if (!q || answerIndex < 0 || answerIndex >= q.answers.length) return false;

    player.answered = true;
    this.answersThisRound.set(socketId, {
      answerIndex,
      timeMs: Date.now() - this.questionStartedAt,
    });
    return true;
  }

  allAnswered() {
    return this.players.size > 0 && this.answersThisRound.size >= this.players.size;
  }

  // Calcule les points de la manche et met à jour les scores.
  // Retourne les stats pour l'affichage (répartition des réponses).
  computeReveal() {
    const q = this.currentQuestion;
    const timeMs = q.time * 1000;
    const distribution = new Array(q.answers.length).fill(0);

    for (const [socketId, player] of this.players) {
      const ans = this.answersThisRound.get(socketId);
      if (!ans) {
        player.streak = 0;
        player.lastPoints = 0;
        continue;
      }
      distribution[ans.answerIndex] += 1;
      const correct = ans.answerIndex === q.correctIndex;
      if (correct) {
        // Facteur de vitesse : de 1.0 (instantané) à 0.5 (à la fin du chrono).
        const speedFactor = Math.max(0, 1 - ans.timeMs / timeMs / 2);
        let points = Math.round(MAX_POINTS * speedFactor);
        player.streak += 1;
        // Bonus de série (streak), plafonné.
        const streakBonus = Math.min(player.streak - 1, 5) * 50;
        points += streakBonus;
        player.score += points;
        player.lastPoints = points;
      } else {
        player.streak = 0;
        player.lastPoints = 0;
      }
    }
    this.state = GameState.REVEAL;
    return { correctIndex: q.correctIndex, distribution };
  }

  // Vue "réponse individuelle" envoyée à chaque joueur.
  playerResult(socketId) {
    const player = this.players.get(socketId);
    if (!player) return null;
    const ans = this.answersThisRound.get(socketId);
    const q = this.currentQuestion;
    const correct = ans ? ans.answerIndex === q.correctIndex : false;
    const rank = this.leaderboard().find((p) => p.id === socketId)?.rank ?? null;
    return {
      correct,
      answered: !!ans,
      pointsEarned: player.lastPoints,
      totalScore: player.score,
      streak: player.streak,
      rank,
      totalPlayers: this.players.size,
    };
  }

  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export class GameManager {
  constructor() {
    this.games = new Map(); // pin -> Game
    this.socketIndex = new Map(); // socketId -> { pin, role }
  }

  createGame(hostSocketId, quiz) {
    const pin = generatePin(this.games);
    const game = new Game(pin, hostSocketId, this.normalizeQuiz(quiz));
    this.games.set(pin, game);
    this.socketIndex.set(hostSocketId, { pin, role: "host" });
    return game;
  }

  normalizeQuiz(quiz) {
    const questions = (quiz?.questions || [])
      .map((q) => ({
        text: String(q.text || "").slice(0, 200),
        answers: (q.answers || []).slice(0, 4).map((a) => String(a || "").slice(0, 100)),
        correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
        time: Math.min(Math.max(Number(q.time) || 20, 5), 120),
      }))
      .filter((q) => q.text && q.answers.filter(Boolean).length >= 2);
    return {
      title: String(quiz?.title || "Quiz").slice(0, 80),
      questions,
    };
  }

  getGame(pin) {
    return this.games.get(String(pin || "").trim());
  }

  getBySocket(socketId) {
    const ref = this.socketIndex.get(socketId);
    if (!ref) return null;
    const game = this.games.get(ref.pin);
    if (!game) return null;
    return { game, role: ref.role };
  }

  joinGame(socketId, pin, name) {
    const game = this.getGame(pin);
    if (!game) return { error: "PIN introuvable." };
    if (game.state !== GameState.LOBBY) return { error: "La partie a déjà commencé." };
    const res = game.addPlayer(socketId, name);
    if (res.error) return res;
    this.socketIndex.set(socketId, { pin: game.pin, role: "player" });
    return { game, player: res.player };
  }

  // Nettoie à la déconnexion. Retourne le contexte pour notifier les autres.
  handleDisconnect(socketId) {
    const ref = this.socketIndex.get(socketId);
    this.socketIndex.delete(socketId);
    if (!ref) return null;
    const game = this.games.get(ref.pin);
    if (!game) return null;

    if (ref.role === "host") {
      // L'hôte part : la partie est détruite.
      game.clearTimer();
      this.games.delete(ref.pin);
      return { game, role: "host", destroyed: true };
    }
    game.removePlayer(socketId);
    return { game, role: "player" };
  }

  destroyGame(pin) {
    const game = this.games.get(pin);
    if (game) game.clearTimer();
    this.games.delete(pin);
  }
}

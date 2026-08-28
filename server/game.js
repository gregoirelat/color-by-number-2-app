// Logique de jeu — indépendante du transport (Socket.IO).
// Un GameManager détient toutes les parties en mémoire, indexées par PIN.
//
// Les joueurs sont identifiés par un `playerId` (jeton stable généré à
// l'inscription), et NON par l'ID de socket : cela permet la reconnexion
// (le socket change, le playerId reste, le score est conservé).

import { randomUUID } from "node:crypto";

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
  constructor(pin, hostToken, quiz) {
    this.pin = pin;
    this.hostToken = hostToken; // jeton stable de l'hôte (reconnexion)
    this.hostSocketId = null;
    this.hostConnected = true;
    this.quiz = quiz; // { title, questions: [{ text, answers[], correctIndex, time, image?, type }] }
    this.state = GameState.LOBBY;
    this.players = new Map(); // playerId -> { playerId, socketId, name, score, streak, answered, lastPoints, connected }
    this.currentIndex = -1;
    this.questionStartedAt = 0;
    this.answersThisRound = new Map(); // playerId -> { answerIndex, timeMs }
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
    const connectedCount = [...this.players.values()].filter((p) => p.connected).length;
    if (connectedCount >= MAX_PLAYERS) {
      return { error: "Partie complète." };
    }
    const trimmed = String(name || "").trim().slice(0, 20);
    if (!trimmed) return { error: "Pseudo invalide." };
    const taken = [...this.players.values()].some(
      (p) => p.connected && p.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (taken) return { error: "Ce pseudo est déjà pris." };

    const player = {
      playerId: randomUUID(),
      socketId,
      name: trimmed,
      score: 0,
      streak: 0,
      answered: false,
      lastPoints: 0,
      connected: true,
    };
    this.players.set(player.playerId, player);
    return { player };
  }

  getPlayerByToken(token) {
    return this.players.get(token) || null;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.answersThisRound.delete(playerId);
  }

  // Joueurs connectés (pour le lobby et les comptes de réponses).
  connectedPlayers() {
    return [...this.players.values()].filter((p) => p.connected);
  }

  playerList() {
    return this.connectedPlayers().map((p) => ({ id: p.playerId, name: p.name, score: p.score }));
  }

  // Classement décroissant (inclut les joueurs déconnectés qui gardent leur score).
  leaderboard(limit) {
    const sorted = [...this.players.values()].sort((a, b) => b.score - a.score);
    const arr = sorted.map((p, i) => ({
      id: p.playerId,
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
  submitAnswer(playerId, answerIndex) {
    if (this.state !== GameState.QUESTION) return false;
    const player = this.players.get(playerId);
    if (!player || player.answered) return false;
    const q = this.currentQuestion;
    if (!q || answerIndex < 0 || answerIndex >= q.answers.length) return false;

    player.answered = true;
    this.answersThisRound.set(playerId, {
      answerIndex,
      timeMs: Date.now() - this.questionStartedAt,
    });
    return true;
  }

  allAnswered() {
    const active = this.connectedPlayers();
    return active.length > 0 && active.every((p) => this.answersThisRound.has(p.playerId));
  }

  // Calcule les points de la manche et met à jour les scores.
  computeReveal() {
    const q = this.currentQuestion;
    const timeMs = q.time * 1000;
    const distribution = new Array(q.answers.length).fill(0);

    for (const [playerId, player] of this.players) {
      const ans = this.answersThisRound.get(playerId);
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
  playerResult(playerId) {
    const player = this.players.get(playerId);
    if (!player) return null;
    const ans = this.answersThisRound.get(playerId);
    const q = this.currentQuestion;
    const correct = ans ? ans.answerIndex === q.correctIndex : false;
    const rank = this.leaderboard().find((p) => p.id === playerId)?.rank ?? null;
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
    this.socketIndex = new Map(); // socketId -> { pin, role, playerId? }
  }

  createGame(hostSocketId, quiz) {
    const pin = generatePin(this.games);
    const hostToken = randomUUID();
    const game = new Game(pin, hostToken, this.normalizeQuiz(quiz));
    game.hostSocketId = hostSocketId;
    this.games.set(pin, game);
    this.socketIndex.set(hostSocketId, { pin, role: "host" });
    return game;
  }

  normalizeQuiz(quiz) {
    const validUrl = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u.slice(0, 500) : "");
    const questions = (quiz?.questions || [])
      .map((q) => {
        const type = q.type === "truefalse" ? "truefalse" : "quiz";
        let answers, answerImages;
        if (type === "truefalse") {
          answers = ["Vrai", "Faux"];
          answerImages = ["", ""];
        } else {
          answers = (q.answers || []).slice(0, 4).map((a) => String(a || "").slice(0, 100));
          const rawImg = q.answerImages || [];
          answerImages = answers.map((_, i) => validUrl(rawImg[i]));
        }
        return {
          text: String(q.text || "").slice(0, 200),
          answers,
          answerImages,
          correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
          time: Math.min(Math.max(Number(q.time) || 20, 5), 120),
          type,
          image: validUrl(q.image),
        };
      })
      // Une réponse est "présente" si elle a du texte OU une image.
      .filter((q) => {
        const present = q.answers.filter((t, i) => t || q.answerImages[i]).length;
        return (
          q.text &&
          present >= 2 &&
          q.correctIndex < q.answers.length &&
          (q.answers[q.correctIndex] || q.answerImages[q.correctIndex])
        );
      });
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
    return { game, role: ref.role, playerId: ref.playerId };
  }

  joinGame(socketId, pin, name) {
    const game = this.getGame(pin);
    if (!game) return { error: "PIN introuvable." };
    if (game.state !== GameState.LOBBY) return { error: "La partie a déjà commencé." };
    const res = game.addPlayer(socketId, name);
    if (res.error) return res;
    this.socketIndex.set(socketId, { pin: game.pin, role: "player", playerId: res.player.playerId });
    return { game, player: res.player };
  }

  // Reconnexion d'un joueur via son jeton.
  rejoinPlayer(socketId, pin, token) {
    const game = this.getGame(pin);
    if (!game) return { error: "Partie introuvable." };
    const player = game.getPlayerByToken(token);
    if (!player) return { error: "Session expirée." };
    // Bascule le socket courant vers le joueur existant (score conservé).
    if (player.socketId && player.socketId !== socketId) {
      this.socketIndex.delete(player.socketId);
    }
    player.socketId = socketId;
    player.connected = true;
    this.socketIndex.set(socketId, { pin: game.pin, role: "player", playerId: player.playerId });
    return { game, player };
  }

  // Reconnexion de l'hôte via son jeton.
  rejoinHost(socketId, pin, token) {
    const game = this.getGame(pin);
    if (!game) return { error: "Partie introuvable." };
    if (game.hostToken !== token) return { error: "Jeton hôte invalide." };
    if (game.hostSocketId && game.hostSocketId !== socketId) {
      this.socketIndex.delete(game.hostSocketId);
    }
    game.hostSocketId = socketId;
    game.hostConnected = true;
    this.socketIndex.set(socketId, { pin: game.pin, role: "host" });
    return { game };
  }

  // Marque une socket comme déconnectée sans supprimer l'entité (grâce à la
  // période de grâce gérée côté serveur). Retourne le contexte.
  markDisconnected(socketId) {
    const ref = this.socketIndex.get(socketId);
    this.socketIndex.delete(socketId);
    if (!ref) return null;
    const game = this.games.get(ref.pin);
    if (!game) return null;

    if (ref.role === "host") {
      game.hostConnected = false;
      return { game, role: "host" };
    }
    const player = game.players.get(ref.playerId);
    if (player) {
      player.connected = false;
      player.socketId = null;
    }
    return { game, role: "player", playerId: ref.playerId };
  }

  destroyGame(pin) {
    const game = this.games.get(pin);
    if (game) game.clearTimer();
    this.games.delete(pin);
  }
}

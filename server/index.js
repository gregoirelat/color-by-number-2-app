import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";
import QRCode from "qrcode";
import { GameManager, GameState } from "./game.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const PORT = process.env.PORT || 3000;

// Délai de grâce avant suppression définitive d'un joueur/hôte déconnecté.
const PLAYER_GRACE_MS = 60_000;
const HOST_GRACE_MS = 60_000;

const app = express();
app.set("trust proxy", true); // respecte X-Forwarded-* derrière un reverse proxy
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e6,
  pingTimeout: 20000,
});

const manager = new GameManager();
// Minuteries de suppression après déconnexion, clé = `${pin}:${playerId}` ou `${pin}:host`.
const graceTimers = new Map();

app.use(express.static(PUBLIC_DIR));

function baseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

app.get("/api/qr", async (req, res) => {
  const pin = String(req.query.pin || "").trim();
  if (!/^\d{4,8}$/.test(pin)) {
    return res.status(400).json({ error: "PIN invalide" });
  }
  const joinUrl = `${baseUrl(req)}/play?pin=${pin}`;
  try {
    const dataUrl = await QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 2,
      color: { dark: "#1a1a2e", light: "#ffffff" },
    });
    res.json({ dataUrl, joinUrl });
  } catch (err) {
    res.status(500).json({ error: "Génération QR impossible" });
  }
});

app.get("/healthz", (_req, res) => res.json({ ok: true, games: manager.games.size }));

app.get("/", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
app.get("/host", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "host.html")));
app.get("/play", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "play.html")));

// ---- Helpers ----

const hostRoom = (pin) => `host:${pin}`;
const playerRoom = (pin) => `players:${pin}`;

function emitLobby(game) {
  io.to(hostRoom(game.pin)).emit("lobby:update", {
    players: game.playerList(),
    count: game.connectedPlayers().length,
  });
}

// Envoie un événement à un joueur via son socket courant (si connecté).
function toPlayer(game, player, event, payload) {
  if (player.socketId) io.to(player.socketId).emit(event, payload);
}

function questionPayloadForPlayer(game) {
  const q = game.currentQuestion;
  return {
    index: game.currentIndex,
    total: game.quiz.questions.length,
    answersCount: q.answers.length,
    type: q.type,
    time: q.time,
    startedAt: game.questionStartedAt,
  };
}

function broadcastQuestion(game) {
  const q = game.currentQuestion;
  io.to(hostRoom(game.pin)).emit("game:question", {
    index: game.currentIndex,
    total: game.quiz.questions.length,
    text: q.text,
    answers: q.answers,
    type: q.type,
    image: q.image || "",
    time: q.time,
    startedAt: game.questionStartedAt,
  });
  io.to(playerRoom(game.pin)).emit("game:question", questionPayloadForPlayer(game));
}

function endQuestion(game) {
  if (game.state !== GameState.QUESTION) return;
  game.clearTimer();
  const reveal = game.computeReveal();
  const q = game.currentQuestion;

  io.to(hostRoom(game.pin)).emit("game:reveal", {
    correctIndex: reveal.correctIndex,
    distribution: reveal.distribution,
    answers: q.answers,
    text: q.text,
    image: q.image || "",
    responded: game.answersThisRound.size,
    total: game.connectedPlayers().length,
    isLast: game.isLast,
  });

  for (const player of game.players.values()) {
    toPlayer(game, player, "game:result", game.playerResult(player.playerId));
  }
}

function endGame(game) {
  game.state = GameState.ENDED;
  game.clearTimer();
  io.to(hostRoom(game.pin)).emit("game:end", { leaderboard: game.leaderboard(5) });
  const board = game.leaderboard();
  for (const player of game.players.values()) {
    const me = board.find((p) => p.id === player.playerId);
    toPlayer(game, player, "game:end", {
      rank: me?.rank ?? null,
      score: me?.score ?? 0,
      totalPlayers: game.players.size,
    });
  }
}

// ---- Socket.IO ----

io.on("connection", (socket) => {
  // --- HÔTE : crée une partie ---
  socket.on("host:create", (quiz, cb) => {
    const game = manager.createGame(socket.id, quiz);
    socket.join(hostRoom(game.pin));
    if (typeof cb === "function") {
      cb({
        pin: game.pin,
        hostToken: game.hostToken,
        title: game.quiz.title,
        questionCount: game.quiz.questions.length,
      });
    }
  });

  // --- HÔTE : reconnexion ---
  socket.on("host:rejoin", ({ pin, token }, cb) => {
    const res = manager.rejoinHost(socket.id, pin, token);
    if (res.error) {
      if (typeof cb === "function") cb({ error: res.error });
      return;
    }
    const { game } = res;
    clearGrace(`${game.pin}:host`);
    socket.join(hostRoom(game.pin));
    if (typeof cb === "function") {
      cb({ ok: true, pin: game.pin, title: game.quiz.title, state: game.state });
    }
    emitLobby(game);
    // Renvoie l'état courant pour que l'écran hôte se resynchronise.
    resumeHost(game, socket);
  });

  // --- JOUEUR : rejoint une partie ---
  socket.on("player:join", ({ pin, name }, cb) => {
    const res = manager.joinGame(socket.id, pin, name);
    if (res.error) {
      if (typeof cb === "function") cb({ error: res.error });
      return;
    }
    socket.join(playerRoom(res.game.pin));
    if (typeof cb === "function") {
      cb({
        ok: true,
        pin: res.game.pin,
        token: res.player.playerId,
        name: res.player.name,
        title: res.game.quiz.title,
      });
    }
    emitLobby(res.game);
  });

  // --- JOUEUR : reconnexion ---
  socket.on("player:rejoin", ({ pin, token }, cb) => {
    const res = manager.rejoinPlayer(socket.id, pin, token);
    if (res.error) {
      if (typeof cb === "function") cb({ error: res.error });
      return;
    }
    const { game, player } = res;
    clearGrace(`${game.pin}:${player.playerId}`);
    socket.join(playerRoom(game.pin));
    if (typeof cb === "function") {
      cb({ ok: true, pin: game.pin, name: player.name, title: game.quiz.title, state: game.state });
    }
    emitLobby(game);
    resumePlayer(game, player);
  });

  // --- HÔTE : démarre / question suivante / révèle ---
  socket.on("host:next", () => {
    const ctx = manager.getBySocket(socket.id);
    if (!ctx || ctx.role !== "host") return;
    const { game } = ctx;
    if (game.state === GameState.ENDED) return;

    if (game.state === GameState.QUESTION) {
      endQuestion(game);
      return;
    }

    if (game.isLast && game.state !== GameState.LOBBY) {
      endGame(game);
      return;
    }

    game.startQuestion();
    broadcastQuestion(game);
    game.clearTimer();
    game.timer = setTimeout(() => endQuestion(game), game.currentQuestion.time * 1000 + 500);
  });

  socket.on("host:scoreboard", () => {
    const ctx = manager.getBySocket(socket.id);
    if (!ctx || ctx.role !== "host") return;
    const { game } = ctx;
    if (game.state !== GameState.REVEAL) return;
    game.state = GameState.SCOREBOARD;
    io.to(hostRoom(game.pin)).emit("game:scoreboard", {
      leaderboard: game.leaderboard(10),
      isLast: game.isLast,
    });
  });

  // --- JOUEUR : répond ---
  socket.on("player:answer", ({ answerIndex }) => {
    const ctx = manager.getBySocket(socket.id);
    if (!ctx || ctx.role !== "player") return;
    const { game, playerId } = ctx;
    const ok = game.submitAnswer(playerId, answerIndex);
    if (ok) {
      socket.emit("game:answered", { answerIndex });
      io.to(hostRoom(game.pin)).emit("game:answerCount", {
        responded: game.answersThisRound.size,
        total: game.connectedPlayers().length,
      });
      if (game.allAnswered()) endQuestion(game);
    }
  });

  // --- HÔTE : expulser un joueur ---
  socket.on("host:kick", ({ playerId }) => {
    const ctx = manager.getBySocket(socket.id);
    if (!ctx || ctx.role !== "host") return;
    const { game } = ctx;
    const player = game.players.get(playerId);
    if (player) {
      if (player.socketId) io.to(player.socketId).emit("game:kicked");
      clearGrace(`${game.pin}:${playerId}`);
      game.removePlayer(playerId);
      emitLobby(game);
    }
  });

  socket.on("disconnect", () => {
    const res = manager.markDisconnected(socket.id);
    if (!res) return;
    const { game } = res;

    if (res.role === "host") {
      // Période de grâce : l'hôte peut se reconnecter avant destruction.
      scheduleGrace(`${game.pin}:host`, HOST_GRACE_MS, () => {
        if (!game.hostConnected) {
          io.to(playerRoom(game.pin)).emit("game:closed");
          manager.destroyGame(game.pin);
        }
      });
      return;
    }

    // Joueur : suppression différée (conserve le score pendant la grâce).
    emitLobby(game);
    if (game.state === GameState.QUESTION && game.allAnswered()) endQuestion(game);
    scheduleGrace(`${game.pin}:${res.playerId}`, PLAYER_GRACE_MS, () => {
      const p = game.players.get(res.playerId);
      if (p && !p.connected) {
        game.removePlayer(res.playerId);
        emitLobby(game);
      }
    });
  });
});

// Resynchronise l'écran hôte selon l'état courant.
function resumeHost(game, socket) {
  const q = game.currentQuestion;
  if (game.state === GameState.QUESTION && q) {
    socket.emit("game:question", {
      index: game.currentIndex,
      total: game.quiz.questions.length,
      text: q.text,
      answers: q.answers,
      type: q.type,
      image: q.image || "",
      time: q.time,
      startedAt: game.questionStartedAt,
    });
    socket.emit("game:answerCount", {
      responded: game.answersThisRound.size,
      total: game.connectedPlayers().length,
    });
  } else if (game.state === GameState.REVEAL && q) {
    const distribution = new Array(q.answers.length).fill(0);
    for (const a of game.answersThisRound.values()) distribution[a.answerIndex] += 1;
    socket.emit("game:reveal", {
      correctIndex: q.correctIndex,
      distribution,
      answers: q.answers,
      text: q.text,
      image: q.image || "",
      responded: game.answersThisRound.size,
      total: game.connectedPlayers().length,
      isLast: game.isLast,
    });
  } else if (game.state === GameState.SCOREBOARD) {
    socket.emit("game:scoreboard", { leaderboard: game.leaderboard(10), isLast: game.isLast });
  } else if (game.state === GameState.ENDED) {
    socket.emit("game:end", { leaderboard: game.leaderboard(5) });
  }
}

// Resynchronise un joueur reconnecté selon l'état courant.
function resumePlayer(game, player) {
  if (game.state === GameState.QUESTION) {
    if (player.answered) {
      toPlayer(game, player, "game:answered", {});
    } else {
      toPlayer(game, player, "game:question", questionPayloadForPlayer(game));
    }
  } else if (game.state === GameState.REVEAL || game.state === GameState.SCOREBOARD) {
    toPlayer(game, player, "game:result", game.playerResult(player.playerId));
  } else if (game.state === GameState.ENDED) {
    const me = game.leaderboard().find((p) => p.id === player.playerId);
    toPlayer(game, player, "game:end", {
      rank: me?.rank ?? null,
      score: me?.score ?? 0,
      totalPlayers: game.players.size,
    });
  }
}

function scheduleGrace(key, ms, fn) {
  clearGrace(key);
  graceTimers.set(key, setTimeout(() => {
    graceTimers.delete(key);
    fn();
  }, ms));
}

function clearGrace(key) {
  const t = graceTimers.get(key);
  if (t) {
    clearTimeout(t);
    graceTimers.delete(key);
  }
}

server.listen(PORT, () => {
  console.log(`Kahoot clone en écoute sur http://localhost:${PORT}`);
});

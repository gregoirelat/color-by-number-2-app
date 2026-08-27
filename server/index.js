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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  // Marge pour ~100+ connexions simultanées.
  maxHttpBufferSize: 1e6,
  pingTimeout: 20000,
});

const manager = new GameManager();

app.use(express.static(PUBLIC_DIR));

// URL de base utilisée pour construire le lien de connexion des joueurs.
// Respecte un reverse proxy (X-Forwarded-*) si présent.
function baseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

// Renvoie un QR code (PNG data URL) pour un PIN donné.
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

// Routes SPA légères.
app.get("/", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
app.get("/host", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "host.html")));
app.get("/play", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "play.html")));

// ---- Socket.IO ----

function emitLobby(game) {
  io.to(hostRoom(game.pin)).emit("lobby:update", {
    players: game.playerList(),
    count: game.players.size,
  });
}

const hostRoom = (pin) => `host:${pin}`;
const playerRoom = (pin) => `players:${pin}`;

// Envoie la question courante (vue hôte = tout ; vue joueur = sans la bonne réponse).
function broadcastQuestion(game) {
  const q = game.currentQuestion;
  const payloadHost = {
    index: game.currentIndex,
    total: game.quiz.questions.length,
    text: q.text,
    answers: q.answers,
    time: q.time,
    startedAt: game.questionStartedAt,
  };
  io.to(hostRoom(game.pin)).emit("game:question", payloadHost);
  io.to(playerRoom(game.pin)).emit("game:question", {
    index: game.currentIndex,
    total: game.quiz.questions.length,
    answersCount: q.answers.length,
    time: q.time,
    startedAt: game.questionStartedAt,
  });
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
    responded: game.answersThisRound.size,
    total: game.players.size,
    isLast: game.isLast,
  });

  // Résultat individuel à chaque joueur.
  for (const socketId of game.players.keys()) {
    const result = game.playerResult(socketId);
    io.to(socketId).emit("game:result", result);
  }
}

io.on("connection", (socket) => {
  // --- HÔTE : crée une partie ---
  socket.on("host:create", (quiz, cb) => {
    const game = manager.createGame(socket.id, quiz);
    socket.join(hostRoom(game.pin));
    if (typeof cb === "function") {
      cb({
        pin: game.pin,
        title: game.quiz.title,
        questionCount: game.quiz.questions.length,
      });
    }
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
      cb({ ok: true, pin: res.game.pin, name: res.player.name, title: res.game.quiz.title });
    }
    emitLobby(res.game);
  });

  // --- HÔTE : démarre la partie / question suivante ---
  socket.on("host:next", () => {
    const ctx = manager.getBySocket(socket.id);
    if (!ctx || ctx.role !== "host") return;
    const { game } = ctx;

    if (game.state === GameState.ENDED) return;

    // Si on est en question, on force la fin (skip du chrono).
    if (game.state === GameState.QUESTION) {
      endQuestion(game);
      return;
    }

    // Depuis lobby / reveal / scoreboard -> question suivante s'il en reste.
    if (game.isLast && game.state !== GameState.LOBBY) {
      // Fin du jeu -> podium.
      game.state = GameState.ENDED;
      game.clearTimer();
      io.to(hostRoom(game.pin)).emit("game:end", { leaderboard: game.leaderboard(5) });
      for (const socketId of game.players.keys()) {
        const me = game.leaderboard().find((p) => p.id === socketId);
        io.to(socketId).emit("game:end", {
          rank: me?.rank ?? null,
          score: me?.score ?? 0,
          totalPlayers: game.players.size,
        });
      }
      return;
    }

    game.startQuestion();
    broadcastQuestion(game);

    // Chrono serveur : fin automatique de la question.
    game.clearTimer();
    game.timer = setTimeout(() => endQuestion(game), game.currentQuestion.time * 1000 + 500);
  });

  // --- HÔTE : afficher le classement intermédiaire ---
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
    const { game } = ctx;
    const ok = game.submitAnswer(socket.id, answerIndex);
    if (ok) {
      socket.emit("game:answered", { answerIndex });
      // Informe l'hôte du nombre de réponses reçues.
      io.to(hostRoom(game.pin)).emit("game:answerCount", {
        responded: game.answersThisRound.size,
        total: game.players.size,
      });
      // Tout le monde a répondu -> on clôt tout de suite.
      if (game.allAnswered()) endQuestion(game);
    }
  });

  // --- HÔTE : expulser un joueur ---
  socket.on("host:kick", ({ playerId }) => {
    const ctx = manager.getBySocket(socket.id);
    if (!ctx || ctx.role !== "host") return;
    const { game } = ctx;
    if (game.players.has(playerId)) {
      game.removePlayer(playerId);
      io.to(playerId).emit("game:kicked");
      emitLobby(game);
    }
  });

  socket.on("disconnect", () => {
    const res = manager.handleDisconnect(socket.id);
    if (!res) return;
    if (res.role === "host" && res.destroyed) {
      io.to(playerRoom(res.game.pin)).emit("game:closed");
    } else if (res.role === "player") {
      emitLobby(res.game);
      // Si tout le monde a répondu après ce départ, on peut clore.
      if (res.game.state === GameState.QUESTION && res.game.allAnswered()) {
        endQuestion(res.game);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Kahoot clone en écoute sur http://localhost:${PORT}`);
});

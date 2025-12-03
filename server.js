const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MAX_WORD_LEN = 80;
const COOLDOWN_MS = 1000; // per-client rate limit for addWord

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.static(path.join(__dirname, 'public')));

let words = []; // [{id, text, createdAt}]
const players = {}; // socket.id -> {text, x, y, seed}

io.on('connection', (socket) => {
  console.log(`[Server] client connected ${socket.id}`);
  socket.lastPost = 0;

  // hydrate the new client with existing state
  socket.emit('wordsUpdate', words);

  players[socket.id] = players[socket.id] || {
    text: '',
    x: 0,
    y: 0,
    seed: 0,
  };
  socket.emit('currentPlayers', players);
  socket.broadcast.emit('newPlayer', { id: socket.id, data: players[socket.id] });

  socket.on('updateData', (data = {}) => {
    console.log(`[Server] Update from ${socket.id}:`, data);

    const player = players[socket.id];
    if (!player) return;

    players[socket.id] = {
      text: typeof data.text === 'string' ? data.text.slice(0, MAX_WORD_LEN) : player.text,
      x: Number.isFinite(data.x) ? data.x : player.x,
      y: Number.isFinite(data.y) ? data.y : player.y,
      seed: Number.isFinite(data.seed) ? data.seed : player.seed,
    };

    socket.broadcast.emit('playerUpdated', { id: socket.id, data: players[socket.id] });
  });

  socket.on('addWord', (text) => {
    if (!text || typeof text !== 'string') return;
    const now = Date.now();
    if (now - socket.lastPost < COOLDOWN_MS) return;
    const clean = text.trim().slice(0, MAX_WORD_LEN);
    if (!clean) return;
    socket.lastPost = now;
    const entry = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      text: clean,
      createdAt: now,
    };
    words.push(entry);
    io.emit('wordsUpdate', words);
  });

  socket.on('disconnect', () => {
    console.log(`[Server] client disconnected ${socket.id}`);
    delete players[socket.id];
    socket.broadcast.emit('playerDisconnected', socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

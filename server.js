const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MAX_WORD_LEN = 80;
const COOLDOWN_MS = 1000; // per-client rate limit

let words = []; // [{id, text, createdAt}]

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  socket.emit('wordsUpdate', words);
  socket.lastPost = 0;

  socket.on('addWord', (text) => {
    if (!text || typeof text !== 'string') return;
    const now = Date.now();
    if (now - socket.lastPost < COOLDOWN_MS) return;
    const clean = text.trim().slice(0, MAX_WORD_LEN);
    if (!clean) return;
    socket.lastPost = now;
    const entry = { id: `${now}-${Math.random().toString(36).slice(2,8)}`, text: clean, createdAt: now };
    words.push(entry);
    io.emit('wordsUpdate', words);
  });
});

server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
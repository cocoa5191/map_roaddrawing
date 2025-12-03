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
  

  // 👇 [수정] cors 옵션을 추가해서 모든 접속(*)을 허용해 줍니다.
const io = new Server(server, {
    cors: {
        origin: "*",  // 모든 주소에서 접속 허용
        methods: ["GET", "POST"]
    }
});
// 클라이언트가 텍스트나 위치를 업데이트했을 때
    socket.on('updateData', (data) => {
        // 👇 [추가] 서버 로그: 데이터가 들어오는지 확인
        console.log(`[Server] Update from ${socket.id}:`, data.text); 

        if (players[socket.id]) {
            players[socket.id].text = data.text;
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].seed = data.seed; // seed도 업데이트 되는지 확인

            // 다른 모든 사람에게 변경 사항 전송
            socket.broadcast.emit('playerUpdated', { id: socket.id, data: players[socket.id] });
        }
    });
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

// Render가 지정해주는 포트를 쓰거나, 없으면 3000번을 쓴다는 뜻

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
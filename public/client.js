// 최소 Socket.io 클라이언트 - 서버에서 'wordsUpdate' 이벤트를 받아 window.onWordsUpdate로 전달
const socket = io();
const statusEl = document.getElementById('status');
const wordInput = document.getElementById('wordInput');
const addBtn = document.getElementById('addBtn');

socket.on('connect', () => { statusEl && (statusEl.textContent = 'connected'); });
socket.on('disconnect', () => { statusEl && (statusEl.textContent = 'disconnected'); });

socket.on('wordsUpdate', (words) => {
  // 1) 기존 전역 함수가 있으면 바로 호출
  if (typeof window.onWordsUpdate === 'function') {
    try { window.onWordsUpdate(words); } catch (e) { console.error('onWordsUpdate error', e); }
  }
  // 2) 항상 이벤트로도 방출 -> sketch가 나중에 로드되어도 받을 수 있음
  try {
    window.dispatchEvent(new CustomEvent('realtimeWords', { detail: words }));
  } catch (e) {
    console.error('dispatch realtimeWords failed', e);
  }
  // 3) 개발용 로그
  console.log('wordsUpdate:', words);
});

function sendWord(w) {
  if (!w || !w.trim()) return;
  socket.emit('addWord', w.trim());
}
addBtn.addEventListener('click', () => { sendWord(wordInput.value); wordInput.value = ''; });
wordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { sendWord(wordInput.value); wordInput.value = ''; } });

// integration: 서버에서 받은 words 배열을 처리하는 함수 노출
window.onWordsUpdate = function(words) {
  // words: [{id, text, createdAt}, ...]
  const texts = words.map(w => String(w.text));
  // 우선적으로 네 기존 함수가 있으면 호출
  if (typeof window.rebuildRoadFromWordArray === 'function') {
    try { window.rebuildRoadFromWordArray(texts); } catch (e) { console.error(e); }
    return;
  }
  // 없다면 전역 상태를 갱신하고 필요하면 redraw 호출
  window.realtimeWords = texts;
  if (typeof window.redrawRoad === 'function') {
    try { window.redrawRoad(); } catch (e) { console.error(e); }
  } else {
    // p5 사용 시 loop에 의해 자동 반영되거나, 강제 redraw 필요하면 아래 주석 해제
    // if (typeof redraw === 'function') redraw();
    console.log('realtimeWords updated', texts);
  }
};

// 안전망: 만약 client.js가 먼저 로드돼서 이벤트로 올 경우를 대비
window.addEventListener('realtimeWords', (ev) => {
  try { window.onWordsUpdate && window.onWordsUpdate(ev.detail); } catch (e) { console.error(e); }
});
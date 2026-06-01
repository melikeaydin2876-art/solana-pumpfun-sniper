// ============================================
// FRONTEND - Full Featured UI
// ============================================

let ws;
let botRunning = false;
const MAX_FEED_ITEMS = 60;
const MAX_AI_MESSAGES = 50;
const chartData = [];
const MAX_CHART_POINTS = 200;
let currentStreak = 0;

// Sound
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain); gain.connect(audioCtx.destination);
  if (type === 'profit') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.1);
    osc.frequency.setValueAtTime(1320, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.start(); osc.stop(audioCtx.currentTime + 0.4);
  } else if (type === 'snipe') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.setValueAtTime(900, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
    osc.start(); osc.stop(audioCtx.currentTime + 0.12);
  } else if (type === 'loss') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
  }
}

// ============================================
// WebSocket
// ============================================
function connectWS() {
  ws = new WebSocket(`ws://${location.host}`);
  ws.onopen = () => updateConnectionUI(true);
  ws.onmessage = (e) => { const { event, data } = JSON.parse(e.data); handleEvent(event, data); };
  ws.onclose = () => { updateConnectionUI(false); setTimeout(connectWS, 2000); };
  ws.onerror = () => updateConnectionUI(false);
}
function send(action, payload = {}) { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ action, payload })); }

// ============================================
// Events
// ============================================
function handleEvent(event, data) {
  switch (event) {
    case 'stats-update': updateStats(data); break;
    case 'price-update': updatePositions(data); break;
    case 'new-token': addFeedItem(data, false); break;
    case 'buy': addFeedItem(data, true); playSound('snipe'); break;
    case 'sell': handleSell(data); break;
    case 'ai-message': addAiMessage(data); break;
    case 'connection-status': updateBotStatus(data); break;
    case 'ai-scanning': break; // disabled
    case 'boost-activated': activateBoostUI(); break;
    case 'boost-deactivated': deactivateBoostUI(); break;
  }
}

// ============================================
// Stats
// ============================================
function updateStats(stats) {
  botRunning = stats.running;
  updateButtonStates();

  setText('stat-balance', `${stats.balance.toFixed(4)} SOL`);
  setText('stat-start', `Start: ${stats.startBalance.toFixed(4)} SOL`);

  const pnl = stats.totalPnl;
  const todayProfit = pnl;
  document.getElementById('stat-today-profit').textContent = `${todayProfit >= 0 ? '+' : ''}${todayProfit.toFixed(4)} SOL`;

  const hours = stats.uptime / 3600000;
  const rate = hours > 0.01 ? (todayProfit / hours) : 0;
  setText('stat-profit-rate', `~${rate.toFixed(3)} SOL/hr`);

  const wr = parseFloat(stats.winRate);
  setTextWithClass('stat-winrate', `${stats.winRate}%`, wr >= 50 ? 'positive' : wr > 0 ? 'negative' : '');
  setText('stat-wl', `W: ${stats.wins} / L: ${stats.losses}`);
  setText('stat-trades', `${stats.totalTrades}`);
  setText('stat-positions', `Open: ${stats.openPositions} / 20`);
  setText('stat-tpm', `${stats.tokensPerMinute || '~'} tok/min`);
  setText('feed-rate', `${stats.tokensPerMinute || '~'} tok/min`);
  setText('stat-accuracy', `${stats.aiAccuracy.toFixed(1)}%`);

  const mins = Math.floor(stats.uptime / 60000);
  const secs = Math.floor((stats.uptime % 60000) / 1000);
  const hrs = Math.floor(mins / 60);
  setText('stat-uptime', hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m ${secs}s`);

  // Badge
  const badge = document.getElementById('badge-status');
  if (stats.running) { badge.textContent = 'ACTIVE'; badge.classList.add('running'); }
  else { badge.textContent = 'IDLE'; badge.classList.remove('running'); }

  // Boost button
  const boostBtn = document.getElementById('btn-boost');
  if (stats.boostMode) boostBtn.classList.add('active');
  else boostBtn.classList.remove('active');

  // Session Goal
  const goalPct = Math.min(100, Math.max(0, (todayProfit / stats.sessionGoal) * 100));
  document.getElementById('goal-bar-fill').style.width = goalPct + '%';
  setText('goal-current', todayProfit.toFixed(2));
  setText('goal-target', stats.sessionGoal.toFixed(2));

  // Best/Worst trade
  if (stats.bestTrade) {
    document.getElementById('best-trade').innerHTML =
      `<span style="color:var(--green)">+${stats.bestTrade.finalPnl.toFixed(4)} SOL</span> <span style="color:var(--text-muted)">${esc(stats.bestTrade.name)}</span>`;
  }
  if (stats.worstTrade) {
    document.getElementById('worst-trade').innerHTML =
      `<span style="color:var(--red)">${stats.worstTrade.finalPnl.toFixed(4)} SOL</span> <span style="color:var(--text-muted)">${esc(stats.worstTrade.name)}</span>`;
  }

  // Chart
  updateChart(todayProfit);
  const chartVal = document.getElementById('chart-current');
  if (chartVal) { chartVal.textContent = `${todayProfit >= 0 ? '+' : ''}${todayProfit.toFixed(4)}`; chartVal.style.color = todayProfit >= 0 ? 'var(--green)' : 'var(--red)'; }
}

// ============================================
// Positions with sparklines
// ============================================
function updatePositions(positions) {
  const body = document.getElementById('positions-body');
  if (!positions || positions.length === 0) {
    body.innerHTML = `<tr class="empty-row"><td colspan="6">${botRunning ? 'Scanning...' : 'Press Start to begin...'}</td></tr>`;
    return;
  }
  positions.sort((a, b) => b.pnlPercent - a.pnlPercent);
  let html = '';
  for (const pos of positions) {
    const cls = pos.pnlPercent >= 0 ? 'pnl-positive' : 'pnl-negative';
    const sign = pos.pnlPercent >= 0 ? '+' : '';
    const hold = formatDuration(Date.now() - pos.buyTime);
    const riskCls = `risk-${pos.riskScore ? pos.riskScore.toLowerCase() : 'medium'}`;
    const sparkId = `spark-${pos.mint.slice(0,8)}`;

    html += `<tr>
      <td><span class="token-name">${esc(pos.name)}</span><br><span class="token-symbol">$${esc(pos.symbol)}</span><br><span class="token-amount">${formatTokenAmount(pos.tokenAmount)} tokens</span></td>
      <td><canvas class="sparkline" id="${sparkId}" data-prices='${JSON.stringify(pos.priceHistory || [])}'></canvas></td>
      <td><span class="${riskCls}">${pos.riskScore || 'MED'}</span></td>
      <td class="${cls}">${sign}${pos.pnlPercent.toFixed(1)}%<br><small>${sign}${pos.pnl.toFixed(4)}</small></td>
      <td class="mono">${hold}</td>
      <td><button class="btn-sell" onclick="sellPos('${pos.mint}')">SELL</button></td>
    </tr>`;
  }
  body.innerHTML = html;

  // Draw sparklines
  requestAnimationFrame(() => {
    for (const pos of positions) {
      const id = `spark-${pos.mint.slice(0,8)}`;
      const canvas = document.getElementById(id);
      if (canvas && pos.priceHistory && pos.priceHistory.length > 1) {
        drawSparkline(canvas, pos.priceHistory, pos.pnlPercent >= 0);
      }
    }
  });
}

function drawSparkline(canvas, data, positive) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width = 60 * window.devicePixelRatio;
  const h = canvas.height = 24 * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  const rw = 60, rh = 24;
  ctx.clearRect(0, 0, rw, rh);

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  ctx.strokeStyle = positive ? '#00ff88' : '#ff3366';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * rw;
    const y = rh - ((data[i] - min) / range) * (rh - 4) - 2;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// ============================================
// Sell
// ============================================
function handleSell(trade) {
  addHistoryRow(trade);
  if (trade.finalPnl > 0) {
    currentStreak++;
    playSound('profit');
    showPopup(trade.finalPnl, true);
    if (trade.finalPnl > 0.02) fireConfetti();
  } else {
    currentStreak = 0;
    playSound('loss');
    showPopup(trade.finalPnl, false);
  }
  const el = document.getElementById('stat-streak');
  el.textContent = currentStreak > 0 ? `🔥 ${currentStreak}` : '0';
  el.className = `stat-value ${currentStreak > 0 ? 'positive' : ''}`;
}

function showPopup(amount, isProfit) {
  const popup = document.getElementById('profit-popup');
  const amountEl = document.getElementById('profit-popup-amount');
  const labelEl = document.getElementById('profit-popup-label');

  if (isProfit) {
    amountEl.textContent = `+${amount.toFixed(4)} SOL`;
    amountEl.style.color = '#00ff88';
    labelEl.textContent = 'PROFIT SECURED 💰';
    labelEl.style.color = '#00ff88';
    popup.style.borderColor = '#00ff88';
    popup.style.background = 'rgba(0, 255, 136, 0.1)';
    popup.style.boxShadow = '0 0 60px rgba(0, 255, 136, 0.3)';
  } else {
    amountEl.textContent = `${amount.toFixed(4)} SOL`;
    amountEl.style.color = '#ff3366';
    labelEl.textContent = 'LOSS MINIMIZED 🛑';
    labelEl.style.color = '#ff3366';
    popup.style.borderColor = '#ff3366';
    popup.style.background = 'rgba(255, 51, 102, 0.1)';
    popup.style.boxShadow = '0 0 60px rgba(255, 51, 102, 0.3)';
  }

  popup.classList.remove('show');
  void popup.offsetWidth;
  popup.classList.add('show');
  setTimeout(() => popup.classList.remove('show'), 2000);
}

function addHistoryRow(trade) {
  const body = document.getElementById('history-body');
  const empty = body.querySelector('.empty-row');
  if (empty) empty.remove();
  const cls = trade.finalPnl >= 0 ? 'pnl-positive' : 'pnl-negative';
  const sign = trade.finalPnl >= 0 ? '+' : '';
  const rcls = `reason-${trade.reason.toLowerCase()}`;
  const row = document.createElement('tr');
  row.className = 'fade-in';
  row.innerHTML = `
    <td><span class="token-name">${esc(trade.name)}</span><br><span class="token-symbol">$${esc(trade.symbol)}</span></td>
    <td class="${rcls}">${trade.reason}</td>
    <td class="${cls}">${sign}${trade.finalPnlPercent.toFixed(1)}% (${sign}${trade.finalPnl.toFixed(4)})</td>
    <td class="mono">${formatDuration(trade.holdTime)}</td>`;
  body.insertBefore(row, body.firstChild);
  while (body.children.length > 50) body.removeChild(body.lastChild);
  document.getElementById('history-count').textContent = body.children.length;
}

// ============================================
// AI Scanning Animation
// ============================================
function showScanning(data) {
  const overlay = document.getElementById('scanning-overlay');
  document.getElementById('scanning-token-name').textContent = `${data.token.name} ($${data.token.symbol})`;
  document.getElementById('scanning-risk').textContent = data.riskScore;
  document.getElementById('scanning-risk').className = `risk-${data.riskScore.toLowerCase()}`;
  document.getElementById('scanning-prediction').textContent = `+${data.prediction}%`;
  document.getElementById('scanning-confidence').textContent = `${data.confidence}%`;
  document.getElementById('scanning-bar-fill').style.width = '0%';

  overlay.classList.add('show');
  setTimeout(() => document.getElementById('scanning-bar-fill').style.width = '100%', 50);
  setTimeout(() => overlay.classList.remove('show'), 900);
}

// ============================================
// Confetti
// ============================================
function fireConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#00ff88', '#ffaa00', '#7c3aed', '#00ddff', '#ff3366'];

  for (let i = 0; i < 80; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 12 - 4,
      size: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      p.life -= 0.015;
      if (p.life <= 0) continue;
      alive = true;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    if (alive && frame < 120) { frame++; requestAnimationFrame(animate); }
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}

// ============================================
// AI Messages & Feed
// ============================================
function addAiMessage(data) {
  const container = document.getElementById('ai-messages');
  const msg = document.createElement('div');
  msg.className = `ai-msg ai-msg-${data.type || 'system'}`;
  msg.innerHTML = `<span class="ai-time">${getCaliforniaTime()}</span><span class="ai-text">${esc(data.text)}</span>`;
  container.appendChild(msg);
  while (container.children.length > MAX_AI_MESSAGES) container.removeChild(container.firstChild);
  container.scrollTop = container.scrollHeight;
}

function addFeedItem(token, sniped) {
  const feed = document.getElementById('token-feed');
  const waiting = feed.querySelector('.feed-item-waiting');
  if (waiting) waiting.remove();
  const item = document.createElement('div');
  item.className = `feed-item ${sniped ? 'feed-item-sniped' : 'feed-item-new'}`;
  const mint = token.mint ? token.mint.slice(0, 8) + '...' : '';
  item.innerHTML = `<span class="feed-icon">${sniped ? '🎯' : '🆕'}</span>
    <span class="feed-time">${getCaliforniaTime()}</span>
    <span class="feed-name">${esc(token.name || 'Unknown')}</span>
    <span class="feed-symbol">$${esc(token.symbol || '???')}</span>
    <span class="feed-mint">${mint}</span>`;
  feed.insertBefore(item, feed.firstChild);
  while (feed.children.length > MAX_FEED_ITEMS) feed.removeChild(feed.lastChild);
}

// ============================================
// Chart
// ============================================
function updateChart(val) {
  chartData.push(val);
  if (chartData.length > MAX_CHART_POINTS) chartData.shift();
  drawChart();
}

function drawChart() {
  const canvas = document.getElementById('pnl-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);
  if (chartData.length < 2) return;

  const min = Math.min(...chartData, 0);
  const max = Math.max(...chartData, 0.001);
  const range = max - min || 0.001;
  const lastVal = chartData[chartData.length - 1];
  const color = lastVal >= 0 ? '#00ff88' : '#ff3366';

  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.beginPath();
  const step = w / (MAX_CHART_POINTS - 1);
  const startIdx = MAX_CHART_POINTS - chartData.length;
  for (let i = 0; i < chartData.length; i++) {
    const x = (startIdx + i) * step;
    const y = h - ((chartData[i] - min) / range) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, lastVal >= 0 ? 'rgba(0,255,136,0.12)' : 'rgba(255,51,102,0.12)');
  grad.addColorStop(1, 'transparent');
  ctx.lineTo((startIdx + chartData.length - 1) * step, h);
  ctx.lineTo(startIdx * step, h);
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
}

// ============================================
// Connection
// ============================================
function updateConnectionUI(connected) {
  const el = document.getElementById('conn-status');
  el.innerHTML = connected ? '<span class="status-dot connected"></span> Online' : '<span class="status-dot disconnected"></span> Reconnecting...';
}
function updateBotStatus(data) {
  const el = document.getElementById('conn-status');
  if (data.connected) el.innerHTML = '<span class="status-dot connected"></span> Online';
  else if (data.status === 'paused') el.innerHTML = '<span class="status-dot"></span> Paused';
  else el.innerHTML = '<span class="status-dot disconnected"></span> Offline';
}

// ============================================
// Controls
// ============================================
function updateButtonStates() {
  document.getElementById('btn-start').disabled = botRunning;
  document.getElementById('btn-pause').disabled = !botRunning;
  document.getElementById('btn-boost').disabled = !botRunning;
}

document.getElementById('btn-start').onclick = () => { send('toggle'); if (audioCtx.state === 'suspended') audioCtx.resume(); };
document.getElementById('btn-pause').onclick = () => send('toggle');
document.getElementById('btn-boost').onclick = () => send('boost');
document.getElementById('btn-reset').onclick = () => {
  send('reset');
  document.getElementById('history-body').innerHTML = '<tr class="empty-row"><td colspan="4">No closed trades yet</td></tr>';
  document.getElementById('ai-messages').innerHTML = '';
  document.getElementById('token-feed').innerHTML = '<div class="feed-item feed-item-waiting">Waiting for start...</div>';
  document.getElementById('history-count').textContent = '0';
  chartData.length = 0; currentStreak = 0;
  document.getElementById('stat-streak').textContent = '0';
  document.getElementById('best-trade').textContent = '---';
  document.getElementById('worst-trade').textContent = '---';
};

// Config sliders
document.getElementById('cfg-tp').oninput = (e) => {
  const v = e.target.value;
  document.getElementById('cfg-tp-val').textContent = `+${v - 100}%`;
  send('update-config', { takeProfit: v / 100 });
};
document.getElementById('cfg-sl').oninput = (e) => {
  const v = e.target.value;
  document.getElementById('cfg-sl-val').textContent = `-${100 - v}%`;
  send('update-config', { stopLoss: v / 100 });
};
document.getElementById('cfg-buy').oninput = (e) => {
  const v = (e.target.value / 100).toFixed(2);
  document.getElementById('cfg-buy-val').textContent = v;
  send('update-config', { buyAmount: parseFloat(v) });
};

function sellPos(mint) { send('sell', { mint }); }
window.sellPos = sellPos;

// ============================================
// Helpers
// ============================================
function setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }
function setTextWithClass(id, t, c) { const el = document.getElementById(id); if (el) { el.textContent = t; el.className = `stat-value ${c}`; } }
function fmtPrice(p) { if (p < 0.000001) return '<0.000001'; if (p < 0.001) return p.toFixed(8); if (p < 1) return p.toFixed(6); return p.toFixed(4); }
function formatTokenAmount(n) { if (n >= 1000000000) return (n/1000000000).toFixed(1) + 'B'; if (n >= 1000000) return (n/1000000).toFixed(1) + 'M'; if (n >= 1000) return (n/1000).toFixed(1) + 'K'; return n.toFixed(0); }
function formatDuration(ms) { const s = Math.floor(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60); if (h > 0) return `${h}h ${m%60}m`; if (m > 0) return `${m}m ${s%60}s`; return `${s}s`; }
function esc(str) { if (!str) return ''; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function getCaliforniaTime() { return new Date().toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour12: false }); }

// ============================================
// Splitters
// ============================================
function initSplitters() {
  const splitter1 = document.getElementById('splitter-1');
  const splitter2 = document.getElementById('splitter-2');
  const colLeft = document.getElementById('col-left');
  const colMid = document.getElementById('col-mid');
  const colRight = document.getElementById('col-right');

  function onMouseDown(e, splitter, leftCol, rightCol) {
    e.preventDefault();
    const startX = e.clientX;
    const leftW = leftCol.getBoundingClientRect().width;
    const rightW = rightCol.getBoundingClientRect().width;
    splitter.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(e) {
      const dx = e.clientX - startX;
      if (leftW + dx >= 200 && rightW - dx >= 150) {
        leftCol.style.flex = 'none'; leftCol.style.width = (leftW + dx) + 'px';
        rightCol.style.flex = 'none'; rightCol.style.width = (rightW - dx) + 'px';
      }
    }
    function onUp() {
      splitter.classList.remove('active');
      document.body.style.cursor = ''; document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  splitter1.addEventListener('mousedown', (e) => onMouseDown(e, splitter1, colLeft, colMid));
  splitter2.addEventListener('mousedown', (e) => onMouseDown(e, splitter2, colMid, colRight));
}

// ============================================
// BOOST MODE UI
// ============================================
function activateBoostUI() {
  document.body.classList.add('boost-active');
  document.getElementById('btn-boost').classList.add('active');
}

function deactivateBoostUI() {
  document.body.classList.remove('boost-active');
  document.getElementById('btn-boost').classList.remove('active');
}

// ============================================
// 3D GLOBE with nodes
// ============================================
function initGlobe() {
  const canvas = document.getElementById('globe-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Node locations (lat, lon) - major cities
  const nodes = [
    { lat: 40.7, lon: -74 },    // New York
    { lat: 51.5, lon: -0.1 },   // London
    { lat: 35.7, lon: 139.7 },  // Tokyo
    { lat: 1.3, lon: 103.8 },   // Singapore
    { lat: -33.9, lon: 151.2 }, // Sydney
    { lat: 37.6, lon: -122.4 }, // San Francisco
    { lat: 55.8, lon: 37.6 },   // Moscow
    { lat: 19.4, lon: -99.1 },  // Mexico City
    { lat: -23.5, lon: -46.6 }, // Sao Paulo
    { lat: 48.9, lon: 2.3 },    // Paris
    { lat: 25.2, lon: 55.3 },   // Dubai
    { lat: 22.3, lon: 114.2 },  // Hong Kong
    { lat: 28.6, lon: 77.2 },   // Delhi
    { lat: 39.9, lon: 116.4 },  // Beijing
    { lat: 52.5, lon: 13.4 },   // Berlin
    { lat: -1.3, lon: 36.8 },   // Nairobi
    { lat: 30.0, lon: 31.2 },   // Cairo
    { lat: 59.3, lon: 18.1 },   // Stockholm
    { lat: 41.0, lon: 29.0 },   // Istanbul
    { lat: 13.8, lon: 100.5 },  // Bangkok
    { lat: -34.6, lon: -58.4 }, // Buenos Aires
    { lat: 43.7, lon: -79.4 },  // Toronto
    { lat: 47.6, lon: -122.3 }, // Seattle
    { lat: 33.9, lon: -118.2 }, // Los Angeles
    { lat: 64.1, lon: -21.9 },  // Reykjavik
    { lat: -6.2, lon: 106.8 },  // Jakarta
    { lat: 37.5, lon: 127.0 },  // Seoul
    { lat: 14.6, lon: 121.0 },  // Manila
    { lat: 35.2, lon: -80.8 },  // Charlotte
    { lat: -26.2, lon: 28.0 },  // Johannesburg
    { lat: 45.5, lon: -73.6 },  // Montreal
  ];

  let rotation = 0;
  let activeNode = 0;
  let pulsePhase = 0;

  function draw() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const w = rect.width, h = rect.height;
    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) * 0.38;

    ctx.clearRect(0, 0, w, h);
    rotation += 0.004;
    pulsePhase += 0.05;

    // Draw globe outline
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Draw latitude lines
    ctx.strokeStyle = 'rgba(85, 85, 128, 0.15)';
    ctx.lineWidth = 0.5;
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = cy - (lat / 90) * r;
      const rr = Math.cos(lat * Math.PI / 180) * r;
      ctx.beginPath();
      ctx.ellipse(cx, y, rr, rr * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw longitude lines
    for (let lon = 0; lon < 180; lon += 30) {
      ctx.beginPath();
      const angle = (lon + rotation * 180 / Math.PI) * Math.PI / 180;
      ctx.ellipse(cx, cy, Math.abs(Math.cos(angle)) * r, r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw nodes
    activeNode = (activeNode + 0.02) % nodes.length;
    const activeIdx = Math.floor(activeNode);

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const lonRad = (node.lon * Math.PI / 180) + rotation;
      const latRad = node.lat * Math.PI / 180;

      const x3d = Math.cos(latRad) * Math.sin(lonRad);
      const z3d = Math.cos(latRad) * Math.cos(lonRad);
      const y3d = Math.sin(latRad);

      // Only draw if on front side
      if (z3d < -0.1) continue;

      const px = cx + x3d * r;
      const py = cy - y3d * r;
      const size = 2 + z3d * 1.5;

      // Active node pulses
      const isActive = i === activeIdx;
      if (isActive) {
        const pulse = Math.sin(pulsePhase) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(px, py, size + 4 + pulse * 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 136, ${0.15 + pulse * 0.15})`;
        ctx.fill();
      }

      // Node dot
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#00ff88' : 'rgba(124, 58, 237, 0.8)';
      ctx.fill();

      // Connection lines between nearby visible nodes
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const lon2 = (n2.lon * Math.PI / 180) + rotation;
        const lat2 = n2.lat * Math.PI / 180;
        const z2 = Math.cos(lat2) * Math.cos(lon2);
        if (z2 < -0.1) continue;

        const x2 = cx + Math.cos(lat2) * Math.sin(lon2) * r;
        const y2 = cy - Math.sin(lat2) * r;
        const dist = Math.hypot(px - x2, py - y2);

        if (dist < r * 1.2) {
          ctx.strokeStyle = `rgba(124, 58, 237, ${0.1 + (1 - dist / (r * 1.2)) * 0.15})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  }

  draw();
}

// ============================================
// INIT
// ============================================
connectWS();
updateButtonStates();
initSplitters();
initGlobe();
document.addEventListener('click', () => { if (audioCtx.state === 'suspended') audioCtx.resume(); }, { once: true });

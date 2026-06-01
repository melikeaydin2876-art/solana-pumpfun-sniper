// ============================================
// 🎯 PUMP.FUN SNIPER BOT - WEB SERVER
// ============================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { SniperEngine } = require('./engine.js');

const PORT = 3000;

// ============================================
// HTTP Server
// ============================================

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'renderer', filePath);

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// ============================================
// WebSocket Server
// ============================================

const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);

  // Send current state to new client
  ws.send(JSON.stringify({ event: 'stats-update', data: engine.getStats() }));
  ws.send(JSON.stringify({ event: 'price-update', data: engine.getPositions() }));

  ws.on('message', (msg) => {
    try {
      const { action, payload } = JSON.parse(msg);
      handleClientAction(action, payload, ws);
    } catch (e) { /* ignore */ }
  });

  ws.on('close', () => clients.delete(ws));
});

function broadcast(event, data) {
  const msg = JSON.stringify({ event, data });
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}

function handleClientAction(action, payload, ws) {
  switch (action) {
    case 'toggle':
      engine.toggle();
      break;
    case 'reset':
      engine.reset();
      break;
    case 'sell':
      engine.manualSell(payload.mint);
      break;
    case 'update-config':
      engine.updateConfig(payload);
      break;
    case 'boost':
      engine.activateBoost();
      break;
  }
}

// ============================================
// Sniper Engine
// ============================================

const engine = new SniperEngine((event, data) => {
  broadcast(event, data);
});

// ============================================
// START
// ============================================

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════════════════════╗');
  console.log('  ║   🎯 PUMP.FUN SNIPER BOT                                ║');
  console.log('  ╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  🌐 GUI: http://localhost:${PORT}`);
  console.log('  📡 WebSocket server running');
  console.log('  ⏳ Waiting for Start button...');
  console.log('');

  // Auto-open browser
  const { exec } = require('child_process');
  exec(`start http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\n  Shutting down...');
  engine.stop();
  process.exit(0);
});

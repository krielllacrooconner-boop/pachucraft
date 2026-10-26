/* =====================================================================
   VoxelCraft — Servidor (online + archivos estáticos)
   Ejecutar:  node server.js
===================================================================== */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const DIR = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json'
};
// Solo se sirven los archivos del juego (no server.js, package.json, logs, etc.)
const PUBLIC_FILES = new Set(['/index.html', '/game.js', '/network.js', '/style.css']);

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { res.writeHead(400); res.end('400'); return; }
  if (p === '/') p = '/index.html';
  const ok = PUBLIC_FILES.has(p) || /^\/textures\/[\w.\-]+\.png$/.test(p);
  if (!ok) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404'); return; }
  const filePath = path.join(DIR, path.normalize(p));
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------- Mundo compartido ----------
const WORLD_SEED = 1 + Math.floor(Math.random() * 99999);   // todos los clientes generan el mismo mundo
const WORLD_TYPE = 'normal';
const edits = new Map();                                     // "x,y,z" -> bloque (0 = roto)
const CH = 80;
const num = v => typeof v === 'number' && isFinite(v);
const validPos = m => num(m.x) && num(m.y) && num(m.z) &&
  Number.isInteger(m.x) && Number.isInteger(m.y) && Number.isInteger(m.z) &&
  Math.abs(m.x) < 1e6 && Math.abs(m.z) < 1e6 && m.y >= 0 && m.y < CH;

const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Map();
let nextId = 1;

function broadcast(obj, exceptWs) {
  const s = JSON.stringify(obj);
  wss.clients.forEach(c => { if (c !== exceptWs && c.readyState === 1) c.send(s); });
}
function playerList() {
  const list = [];
  clients.forEach(c => {
    if (c.ws.readyState === 1) list.push({ id: c.id, name: c.name, x: c.x, y: c.y, z: c.z, yaw: c.yaw, pitch: c.pitch });
  });
  return { t: 'players', list };
}

wss.on('connection', ws => {
  const id = nextId++;
  clients.set(ws, { id, ws, name: 'Jugador', x: 0, y: 30, z: 0, yaw: 0, pitch: 0 });
  ws.send(JSON.stringify({ t: 'joined', id, name: 'Jugador', seed: WORLD_SEED, wtype: WORLD_TYPE }));
  if (edits.size) {
    const list = [];
    edits.forEach((b, k) => { const [x, y, z] = k.split(',').map(Number); list.push({ x, y, z, b }); });
    ws.send(JSON.stringify({ t: 'edits', list }));
  }

  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    const c = clients.get(ws);
    if (!c || !m || typeof m !== 'object') return;
    switch (m.t) {
      case 'join':
        c.name = String(m.name || 'Jugador').slice(0, 16);
        broadcast(playerList());
        break;
      case 'pos':
        if (![m.x, m.y, m.z, m.yaw, m.pitch].every(num)) return;
        c.x = m.x; c.y = m.y; c.z = m.z; c.yaw = m.yaw; c.pitch = m.pitch;
        broadcast({ t: 'pos', id: c.id, name: c.name, x: c.x, y: c.y, z: c.z, yaw: c.yaw, pitch: c.pitch }, ws);
        break;
      case 'break':
        if (!validPos(m)) return;
        edits.set(m.x + ',' + m.y + ',' + m.z, 0);
        broadcast({ t: 'break', x: m.x, y: m.y, z: m.z }, ws);
        break;
      case 'place':
        if (!validPos(m) || !Number.isInteger(m.b) || m.b < 1 || m.b > 15) return;
        edits.set(m.x + ',' + m.y + ',' + m.z, m.b);
        broadcast({ t: 'place', x: m.x, y: m.y, z: m.z, b: m.b }, ws);
        break;
      case 'chat':
        broadcast({ t: 'chat', name: c.name, msg: String(m.msg || '').slice(0, 200) }, ws);
        break;
    }
  });

  const bye = () => { if (clients.delete(ws)) broadcast(playerList()); };
  ws.on('close', bye);
  ws.on('error', bye);
});

server.listen(PORT, () => {
  console.log('VoxelCraft servidor en http://localhost:' + PORT);
});

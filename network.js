/* =====================================================================
   VoxelCraft — Cliente de red (modo online)
===================================================================== */
'use strict';

const net = {
  ws: null,
  active: false,
  url: '',
  players: {},
  myId: null,

  connect(url) {
    const inp = document.getElementById('inpServer');
    let raw = (url || (inp ? inp.value : '') || 'ws://localhost:3000').trim();
    if (!/^wss?:\/\//.test(raw)) raw = 'ws://' + raw;
    raw = raw.replace(/\/+$/, '');
    if (!/\/ws$/.test(raw)) raw += '/ws';          // el servidor escucha en /ws
    this.url = raw;
    const el = document.getElementById('netStatus');
    if (this.ws) { try { this.ws.close(); } catch (e) {} }
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      if (el) el.textContent = '❌ No se pudo crear WebSocket';
      return;
    }
    if (el) el.textContent = 'Conectando a ' + this.url + '…';
    this.ws.onopen = () => {
      this.active = true;
      if (el) el.textContent = '✅ Conectado al servidor';
      this.send({ t: 'join', name: window.playerName || 'Jugador' });
    };
    this.ws.onclose = () => {
      this.active = false;
      this.players = {};
      if (el) el.textContent = '❌ Desconectado';
    };
    this.ws.onerror = () => { if (el) el.textContent = '⚠️ Error de conexión'; };
    this.ws.onmessage = ev => this.handle(ev.data);
  },
  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  },
  sendBreak(x, y, z) { this.send({ t: 'break', x, y, z }); },
  sendPlace(x, y, z, b) { this.send({ t: 'place', x, y, z, b }); },   // b = tipo de bloque
  handle(data) {
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }
    switch (m.t) {
      case 'joined':
        this.myId = m.id;
        ui.hide();
        // mismo seed y tipo que el servidor => todos ven el mismo mundo
        engine.start('multi', { seed: m.seed, type: m.wtype, mode: 'creative' });
        break;
      case 'edits':
        if (window.__voxel) for (const e of m.list) window.__voxel.setBlock(e.x, e.y, e.z, e.b);
        break;
      case 'players':
        this.players = {};
        for (const p of m.list) if (p.id !== this.myId) this.players[p.id] = p;
        break;
      case 'pos':
        if (m.id !== this.myId) this.players[m.id] = { x: m.x, y: m.y, z: m.z, yaw: m.yaw, pitch: m.pitch, name: m.name };
        break;
      case 'break':
        if (window.__voxel) window.__voxel.setBlock(m.x, m.y, m.z, 0);
        break;
      case 'place':
        if (window.__voxel) window.__voxel.setBlock(m.x, m.y, m.z, m.b);
        break;
      case 'chat':
        addChat(m.name + ': ' + m.msg);
        break;
    }
  },
  chat(msg) { this.send({ t: 'chat', msg }); }
};

// Envío de posición: un solo temporizador para toda la sesión
setInterval(() => {
  if (net.active && typeof player !== 'undefined') {
    net.send({ t: 'pos', x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: player.pitch });
  }
}, 100);

// Si el juego se sirve desde un servidor (http/https), usar ese mismo servidor por defecto
(function () {
  const inp = document.getElementById('inpServer');
  if (inp && /^https?:$/.test(location.protocol)) {
    inp.value = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  }
})();

function addChat(txt) {
  const chat = document.getElementById('chat');
  if (!chat) return;
  const d = document.createElement('div');
  d.textContent = txt;
  chat.appendChild(d);
  while (chat.children.length > 30) chat.removeChild(chat.firstChild);
  chat.scrollTop = chat.scrollHeight;
}

window.addEventListener('keydown', e => {
  if (e.key === 'Enter' && net.active) {
    if (document.pointerLockElement) document.exitPointerLock();
    const val = prompt('Chat:');
    if (val) net.chat(val);
  }
});

window.net = net;

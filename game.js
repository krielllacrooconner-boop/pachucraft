/* =====================================================================
   VoxelCraft — Motor WebGL2 (v2)
   Mundo infinito por chunks · biomas · cuevas · minerales · agua
   Mallado greedy · hotbar · inventario · fabricación · guardado
   Pensado para Motorola E13 (gama baja, 2 GB RAM)
===================================================================== */
'use strict';
const $ = id => document.getElementById(id);

// ---------- Config ----------
const CS = 16, CH = 80, SEA = 24;
const TEX_SIZE = 512, TILE = 64, COLS = TEX_SIZE / TILE;
const GRAVITY = 28, JUMP = 9, SPEED = 6.5, TERMINAL = 18, EYE = 1.62;
let RD = 3;                                  // distancia de render (en chunks)

const B = { GRASS: 1, DIRT: 3, STONE: 4, LOG: 5, PLANKS: 6, LEAVES: 7, SAND: 8, WATER: 9, GLASS: 10, COBBLE: 11, SNOW: 12, BEDROCK: 13, COAL: 14, IRON: 15 };
const TR = { 7: 1, 9: 1, 10: 1 };            // semitransparentes
const isSolid = t => t !== 0 && t !== B.WATER;
const BLOCK_NAMES = { 1: 'Pasto', 3: 'Tierra', 4: 'Piedra', 5: 'Tronco', 6: 'Tablones', 7: 'Hojas', 8: 'Arena', 9: 'Agua', 10: 'Vidrio', 11: 'Adoquín', 12: 'Nieve', 13: 'Roca madre', 14: 'Mena de carbón', 15: 'Mena de hierro' };
const DROP = { 1: 3, 4: 11, 7: 0 };          // pasto→tierra, piedra→adoquín, hojas→nada
const CREATIVE_LIST = [1, 3, 4, 5, 6, 7, 8, 10, 11, 12, 14, 15];

// ---------- UI ----------
const SAVE_PREFIX = 'vc_world_';
const ui = {
  show(id) {
    document.querySelectorAll('.overlay').forEach(o => o.classList.remove('visible'));
    const el = $(id);
    if (el) el.classList.add('visible');
  },
  hide() { document.querySelectorAll('.overlay').forEach(o => o.classList.remove('visible')); },
  openMenu(id) {
    if (id === 'create') refreshSaves();
    this.show('menu' + id.charAt(0).toUpperCase() + id.slice(1));
  },
  createWorld() {
    const name = $('inpWorldName').value.trim() || 'Mi Mundo';
    this.startWorld(name, $('inpSeed').value.trim(), $('selWorldType').value, $('selMode').value);
  },
  loadWorld(name) { this.startWorld(name); },
  startWorld(name, seed, type, mode) {
    let save = null;
    try { const raw = localStorage.getItem(SAVE_PREFIX + name); if (raw) save = JSON.parse(raw); } catch (e) { save = null; }
    if (save) { seed = String(save.seed); type = save.type; mode = save.mode; }
    window.playerName = 'Jugador';
    this.show('loading');
    $('loadTxt').textContent = 'Generando mundo…';
    $('loadFill').style.width = '0%';
    setTimeout(() => engine.start('single', { name, seed, type, mode, save }), 30);
  },
  exitGame() {
    if (window.electronAPI && window.electronAPI.exit) window.electronAPI.exit();
    else alert('Cierra la pestaña del navegador para salir.');
  },
};
function listSaves() {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(SAVE_PREFIX)) out.push(k.slice(SAVE_PREFIX.length)); } } catch (e) {}
  return out.sort();
}
function refreshSaves() {
  const box = $('savedWorlds'), l = listSaves();
  box.innerHTML = l.length ? '<div class="label">Mundos guardados:</div>' + l.map(n =>
    '<div class="saveRow"><button class="mcBtn small" data-play="' + encodeURIComponent(n) + '">▶ ' + n.replace(/[<>&"]/g, '') + '</button>' +
    '<button class="mcBtn small secondary" data-del="' + encodeURIComponent(n) + '">🗑</button></div>').join('') : '';
}
$('savedWorlds').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.play) ui.loadWorld(decodeURIComponent(b.dataset.play));
  else if (b.dataset.del) {
    const n = decodeURIComponent(b.dataset.del);
    if (confirm('¿Borrar el mundo "' + n + '"?')) { try { localStorage.removeItem(SAVE_PREFIX + n); } catch (er) {} refreshSaves(); }
  }
});

// ---------- WebGL ----------
const cv = $('gameCanvas');
const gl = cv.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
if (!gl) { alert('WebGL2 no disponible en este navegador'); throw new Error('No WebGL2'); }

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aST;
layout(location=2) in float aTile;
layout(location=3) in float aShade;
uniform mat4 uMvp; uniform vec3 uO; uniform vec3 uCam;
out vec2 vST; out float vTile; out float vShade; out float vDist;
void main(){
  vec3 p = aPos + uO;
  vST = aST; vTile = aTile; vShade = aShade;
  vDist = length(p - uCam);
  gl_Position = uMvp * vec4(p, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uAtlas;
uniform vec3 uFogColor; uniform float uFogDensity;
in vec2 vST; in float vTile; in float vShade; in float vDist;
out vec4 o;
void main(){
  float ti = floor(vTile + 0.5);
  vec2 org = vec2(mod(ti, ${COLS}.0), floor(ti / ${COLS}.0)) / ${COLS}.0;
  float e = 0.5 / ${TILE}.0;
  vec2 uv = org + (vec2(e) + fract(vST) * (1.0 - 2.0 * e)) / ${COLS}.0;
  vec4 t = texture(uAtlas, uv);
  if (t.a < 0.5) discard;
  float vis = clamp(exp(-uFogDensity * vDist), 0.0, 1.0);
  o = vec4(mix(uFogColor, t.rgb * vShade, vis), 1.0);
}`;
function compile(t, s) {
  const sh = gl.createShader(t);
  gl.shaderSource(sh, s); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(sh)); throw new Error('Shader compilation failed'); }
  return sh;
}
const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(prog);
gl.useProgram(prog);
const U = n => gl.getUniformLocation(prog, n);
const locMvp = U('uMvp'), locO = U('uO'), locCam = U('uCam'), locFogC = U('uFogColor'), locFogD = U('uFogDensity');
gl.uniform1i(U('uAtlas'), 0);
gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.frontFace(gl.CCW);
function setAttribs() {   // x y z | s t | tile | sombra  (28 bytes)
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 28, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 20);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 28, 24);
}

// ---------- Texturas ----------
const texMap = {
  1: 'grass_top.png', 2: 'grass_side.png', 3: 'dirt.png', 4: 'stone.png', 5: 'wood_log.png',
  6: 'wood_planks.png', 7: 'leaves.png', 8: 'sand.png', 9: 'water.png', 10: 'glass.png',
  11: 'cobblestone.png', 12: 'snow.png', 13: 'bedrock.png', 14: 'coal_ore.png', 15: 'iron_ore.png'
};
// Si falta una textura se dibuja una de respaldo: color base + motas
const FB = {
  1: { b: [.38, .7, .22] }, 2: { b: [.5, .36, .24], top: [.38, .7, .22] }, 3: { b: [.5, .36, .24] },
  4: { b: [.5, .5, .52] }, 5: { b: [.45, .31, .18], s: [.3, .2, .1] }, 6: { b: [.66, .5, .3], s: [.55, .4, .22] },
  7: { b: [.2, .55, .2], s: [.1, .4, .1] }, 8: { b: [.86, .8, .56] }, 9: { b: [.2, .45, .85] },
  10: { b: [.8, .92, 1], s: [1, 1, 1] }, 11: { b: [.45, .45, .47], s: [.3, .3, .3] }, 12: { b: [.95, .97, 1] },
  13: { b: [.2, .2, .2], s: [.08, .08, .08] }, 14: { b: [.5, .5, .52], s: [.1, .1, .1] }, 15: { b: [.5, .5, .52], s: [.82, .62, .46] }
};
let atlasTex = null, atlasCanvas = null;

function loadTex(name) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'textures/' + name;
  });
}
function drawFallback(ctx, id, cx, cy) {
  const f = FB[id] || { b: [.5, .5, .5] }, n = 8, c = TILE / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = Math.abs(Math.sin(id * 12.9 + i * 78.2 + j * 37.7) * 43758.5) % 1;
    let col = f.b, k = 0.88 + 0.24 * r;
    if (f.s && r < 0.2) { col = f.s; k = 1; }
    if (f.top && j === 0) { col = f.top; k = 0.9 + 0.2 * r; }
    ctx.fillStyle = `rgb(${Math.min(255, col[0] * 255 * k) | 0},${Math.min(255, col[1] * 255 * k) | 0},${Math.min(255, col[2] * 255 * k) | 0})`;
    ctx.fillRect(cx + i * c, cy + j * c, c, c);
  }
}
function buildAtlas(loaded, useImages) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  let idx = 0;
  for (const id in texMap) {
    const cx = (idx % COLS) * TILE, cy = Math.floor(idx / COLS) * TILE, img = loaded[id];
    if (useImages && img && img.naturalWidth > 0) ctx.drawImage(img, cx, cy, TILE, TILE);
    else drawFallback(ctx, +id, cx, cy);
    idx++;
  }
  if (!atlasTex) atlasTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);   // puede lanzar SecurityError
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  atlasCanvas = canvas;
}
async function initTextures() {
  const tearFill = $('tearFill'), tearTxt = $('tearTxt');
  const ids = Object.keys(texMap), loaded = {};
  for (let i = 0; i < ids.length; i++) {
    loaded[ids[i]] = await loadTex(texMap[ids[i]]);
    if (tearFill) tearFill.style.width = ((i + 1) / ids.length * 100) + '%';
    if (tearTxt) tearTxt.textContent = 'Cargando ' + texMap[ids[i]] + '…';
  }
  try { buildAtlas(loaded, true); }
  catch (err) { console.warn('Texturas no usables, uso respaldo:', err); buildAtlas(loaded, false); }
  if (tearTxt) tearTxt.textContent = '¡Listo!';
  await new Promise(r => setTimeout(r, 300));
  const tear = $('loadingTearOfDawn');
  if (tear) tear.classList.remove('visible');
}
initTextures();

// ---------- Ruido y terreno (determinista por semilla) ----------
let SEED = 12345, WTYPE = 'normal';
// Hash entero rápido (≈100x más veloz que usar Math.sin en un celular de gama baja)
const h2 = (x, y) => {
  let n = (Math.imul((x * 8) | 0, 374761393) + Math.imul((y * 8) | 0, 668265263) + Math.imul(SEED + 1, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
};
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return h2(xi, yi) * (1 - u) * (1 - v) + h2(xi + 1, yi) * u * (1 - v) + h2(xi, yi + 1) * (1 - u) * v + h2(xi + 1, yi + 1) * u * v;
}
function fbm(x, z, o) { let a = 1, f = 1, s = 0, n = 0; for (let i = 0; i < o; i++) { s += vn(x * f, z * f) * a; n += a; a *= 0.5; f *= 2; } return s / n; }
const clampf = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clampf((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function strSeed(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 100000; }

// Biomas: 1 llanura · 2 desierto · 3 nieve · 4 montaña · 5 bosque
function colInfo(x, z) {
  if (WTYPE === 'flat') return { h: SEA + 4, b: 1 };
  const amp = WTYPE === 'amplified' ? 1.7 : 1;
  const c = fbm(x / 160, z / 160, 3), hl = fbm(x / 48 + 100, z / 48 + 100, 3), mn = fbm(x / 110 + 500, z / 110 + 500, 2);
  let h = SEA + 4 + clampf((c - 0.5) * 3, -1, 1) * 14 * amp + (hl - 0.5) * 14 * amp + smooth(0.58, 0.72, mn) * 30 * amp;
  h = Math.floor(clampf(h, 3, CH - 12));
  const t = fbm(x / 260 + 900, z / 260 + 900, 2), q = fbm(x / 200 - 700, z / 200 + 300, 2);
  let b;
  if (h > SEA + 22) b = 4; else if (t < 0.3) b = 3; else if (t > 0.58 && q < 0.5) b = 2; else if (q > 0.56) b = 5; else b = 1;
  return { h, b };
}
function treeH(wx, wz, inf) {   // altura del árbol en esa columna (0 = no hay)
  if (WTYPE === 'flat' || inf.h <= SEA + 1 || inf.h > SEA + 24) return 0;
  const p = inf.b === 5 ? 0.035 : inf.b === 1 ? 0.006 : inf.b === 3 ? 0.008 : 0;
  if (!p) return 0;
  const r = h2(wx * 1.73 + 19.1, wz * 2.91 - 7.7);
  return r > p ? 0 : 4 + Math.floor(r / p * 3);
}
function cave(x, y, z) {   // túneles finos: intersección de dos "capas" de ruido
  const a = vn((x + y * 3.1) / 11, (z - y * 2.3) / 11) - 0.5, b = vn((x - y * 1.7) / 11 + 77, (z + y * 3.3) / 11 + 33) - 0.5;
  return a * a + b * b < 0.0016;
}
function findSpawn() {
  for (let r = 0; r < 300; r += 2) for (let a = 0; a < (r ? 8 : 1); a++) {
    const x = Math.round(Math.cos(a * Math.PI / 4) * r), z = Math.round(Math.sin(a * Math.PI / 4) * r), inf = colInfo(x, z);
    if (inf.h < SEA + 2 || inf.h > SEA + 14) continue;
    let ok = true;
    for (let dx = -3; dx <= 3 && ok; dx++) for (let dz = -3; dz <= 3; dz++) if (treeH(x + dx, z + dz, colInfo(x + dx, z + dz))) { ok = false; break; }
    if (ok) return [x + 0.5, inf.h + 1, z + 0.5];
  }
  return [0.5, colInfo(0, 0).h + 2, 0.5];
}

function genChunk(cx, cz) {
  const data = new Uint8Array(CS * CS * CH), ox = cx * CS, oz = cz * CS, M = 3, G = CS + 2 * M;
  const info = new Array(G * G);
  for (let gz = 0; gz < G; gz++) for (let gxx = 0; gxx < G; gxx++) info[gz * G + gxx] = colInfo(ox + gxx - M, oz + gz - M);
  const flat = WTYPE === 'flat';
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const inf = info[(z + M) * G + x + M], h = inf.h, b = inf.b, wx = ox + x, wz = oz + z;
    let top, sub, dl = 3;
    if (b === 4) { top = h >= SEA + 36 ? B.SNOW : B.STONE; sub = B.STONE; dl = 0; }
    else if (h <= SEA + 1) { top = sub = h >= SEA - 5 ? B.SAND : B.DIRT; }
    else if (b === 2) { top = sub = B.SAND; dl = 4; }
    else if (b === 3) { top = B.SNOW; sub = B.DIRT; }
    else { top = B.GRASS; sub = B.DIRT; }
    for (let y = 0; y <= h; y++) {
      const depth = h - y;
      let t;
      if (y === 0 || (y === 1 && h2(wx * 5.1, wz * 3.3) < 0.5)) t = B.BEDROCK;
      else if (depth === 0) t = top;
      else if (depth <= dl) t = sub;
      else {
        t = B.STONE;
        if (!flat && depth > 2 && y > 3) {
          if (cave(wx, y, wz)) continue;
          const r = h2((wx >> 1) * 7.13 + (y >> 1) * 0.37, (wz >> 1) * 3.71 + (y >> 1) * 5.3);
          if (r < 0.022 && y < 56 && h2(wx * 2.3, wz * 4.1 + y) < 0.8) t = B.COAL;
          else if (r > 0.985 && y < 36 && h2(wx * 2.3, wz * 4.1 + y) < 0.8) t = B.IRON;
        }
      }
      data[(y * CS + z) * CS + x] = t;
    }
    for (let y = h + 1; y <= SEA; y++) data[(y * CS + z) * CS + x] = B.WATER;
  }
  // Árboles (incluye los de columnas vecinas, para que crucen bordes de chunk)
  const trees = [];
  for (let gz = 0; gz < G; gz++) for (let gxx = 0; gxx < G; gxx++) {
    const wx = ox + gxx - M, wz = oz + gz - M, inf = info[gz * G + gxx], th = treeH(wx, wz, inf);
    if (th) trees.push([wx - ox, inf.h + 1, wz - oz, th]);
  }
  for (const [tx, ty, tz, th] of trees)
    if (tx >= 0 && tx < CS && tz >= 0 && tz < CS) for (let y = 0; y < th; y++) data[((ty + y) * CS + tz) * CS + tx] = B.LOG;
  for (const [tx, ty, tz, th] of trees)
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 3) continue;
      const lx = tx + dx, lz = tz + dz, ly = ty + th - 1 + dy;
      if (lx < 0 || lx >= CS || lz < 0 || lz >= CS || ly >= CH) continue;
      const i = (ly * CS + lz) * CS + lx;
      if (data[i] === 0) data[i] = B.LEAVES;
    }
  return data;
}

// ---------- Chunks ----------
const chunkMap = new Map();
const editsByChunk = new Map();        // "cx,cz" -> Map(índice -> bloque)  (persisten al descargar chunks)
let saveDirty = false;

function gx(x, y, z) {
  if (y < 0 || y >= CH) return 0;
  const c = chunkMap.get((x >> 4) + ',' + (z >> 4));
  return c ? c.data[(y * CS + (z & 15)) * CS + (x & 15)] : 0;
}
function loadChunk(cx, cz) {
  const key = cx + ',' + cz, c = { cx, cz, data: genChunk(cx, cz), meshed: false, vao: null, vb: null, ib: null, count: 0, type: 0 };
  const em = editsByChunk.get(key);
  if (em) em.forEach((b, i) => { c.data[i] = b; });
  chunkMap.set(key, c);
  return c;
}
function freeChunk(c) { if (c.vao) { gl.deleteVertexArray(c.vao); gl.deleteBuffer(c.vb); gl.deleteBuffer(c.ib); c.vao = null; } }
function clearWorld() { chunkMap.forEach(freeChunk); chunkMap.clear(); }

// ---------- Mallado greedy ----------
const FSH = [0.8, 0.7, 1.0, 0.5, 0.9, 0.75];   // +x -x +y -y +z -z
const faceTex = (t, f) => t === 1 ? (f === 2 ? 1 : f === 3 ? 3 : 2) : t;
const SX = CS + 2, PAD = new Uint8Array(SX * (CH + 2) * SX), pidx = (x, y, z) => ((y + 1) * SX + (z + 1)) * SX + (x + 1);
const MASK = new Int16Array(CS * CH);

function fillPadded(c) {
  PAD.fill(0); PAD.fill(1, 0, SX * SX);   // suelo del mundo: sólido (no se dibuja la cara de abajo)
  const W_ = chunkMap.get((c.cx - 1) + ',' + c.cz), E_ = chunkMap.get((c.cx + 1) + ',' + c.cz);
  const N_ = chunkMap.get(c.cx + ',' + (c.cz - 1)), S_ = chunkMap.get(c.cx + ',' + (c.cz + 1));
  for (let y = 0; y < CH; y++) for (let z = 0; z < CS; z++) {
    const row = (y * CS + z) * CS;
    PAD.set(c.data.subarray(row, row + CS), pidx(0, y, z));
    if (W_) PAD[pidx(-1, y, z)] = W_.data[row + CS - 1];
    if (E_) PAD[pidx(CS, y, z)] = E_.data[row];
  }
  for (let y = 0; y < CH; y++) for (let x = 0; x < CS; x++) {
    if (N_) PAD[pidx(x, y, -1)] = N_.data[(y * CS + CS - 1) * CS + x];
    if (S_) PAD[pidx(x, y, CS)] = S_.data[(y * CS) * CS + x];
  }
}
function meshChunk(c) {
  fillPadded(c);
  const D = [CS, CH, CS], V = [], I = [];
  let n = 0;
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3, v = (d + 2) % 3, x = [0, 0, 0], q = [0, 0, 0];
    q[d] = 1;
    const du_ = D[u], dv_ = D[v];
    for (x[d] = -1; x[d] < D[d];) {
      let k = 0;
      for (x[v] = 0; x[v] < dv_; x[v]++) for (x[u] = 0; x[u] < du_; x[u]++) {
        const a = PAD[pidx(x[0], x[1], x[2])], b = PAD[pidx(x[0] + q[0], x[1] + q[1], x[2] + q[2])];
        let m = 0;   // solo caras de bloques DENTRO de este chunk (las del vecino las dibuja el vecino)
        if (x[d] >= 0 && a && (!b || (TR[b] && b !== a))) m = faceTex(a, d * 2);
        else if (x[d] < D[d] - 1 && b && (!a || (TR[a] && a !== b))) m = -faceTex(b, d * 2 + 1);
        MASK[k++] = m;
      }
      x[d]++; k = 0;
      for (let j = 0; j < dv_; j++) for (let i = 0; i < du_;) {
        const c0 = MASK[k];
        if (!c0) { i++; k++; continue; }
        let w = 1; while (i + w < du_ && MASK[k + w] === c0) w++;
        let h = 1;
        e: for (; j + h < dv_; h++) for (let m = 0; m < w; m++) if (MASK[k + m + h * du_] !== c0) break e;
        x[u] = i; x[v] = j;
        const pos = c0 > 0, tex = pos ? c0 : -c0, f = d * 2 + (pos ? 0 : 1);
        const du = [0, 0, 0], dv = [0, 0, 0]; du[u] = w; dv[v] = h;
        const p = [[x[0], x[1], x[2]], [x[0] + du[0], x[1] + du[1], x[2] + du[2]],
          [x[0] + du[0] + dv[0], x[1] + du[1] + dv[1], x[2] + du[2] + dv[2]], [x[0] + dv[0], x[1] + dv[1], x[2] + dv[2]]];
        const x0 = Math.min(p[0][0], p[2][0]), x1 = Math.max(p[0][0], p[2][0]);
        const y1 = Math.max(p[0][1], p[2][1]), z0 = Math.min(p[0][2], p[2][2]), z1 = Math.max(p[0][2], p[2][2]);
        for (let m = 0; m < 4; m++) {
          const a = p[m]; let s, t;
          switch (f) {
            case 0: s = z1 - a[2]; t = y1 - a[1]; break;
            case 1: s = a[2] - z0; t = y1 - a[1]; break;
            case 2: s = a[0] - x0; t = z1 - a[2]; break;
            case 3: s = a[0] - x0; t = a[2] - z0; break;
            case 4: s = a[0] - x0; t = y1 - a[1]; break;
            default: s = x1 - a[0]; t = y1 - a[1];
          }
          V.push(a[0], a[1], a[2], s, t, tex - 1, FSH[f]);
        }
        if (pos) I.push(n, n + 1, n + 2, n, n + 2, n + 3); else I.push(n, n + 2, n + 1, n, n + 3, n + 2);
        n += 4;
        for (let l = 0; l < h; l++) for (let m = 0; m < w; m++) MASK[k + m + l * du_] = 0;
        i += w; k += w;
      }
    }
  }
  return { V, I, n };
}
function buildMesh(c) {
  const m = meshChunk(c);
  c.meshed = true; c.count = m.I.length;
  if (!c.count) return;
  if (!c.vao) { c.vao = gl.createVertexArray(); c.vb = gl.createBuffer(); c.ib = gl.createBuffer(); }
  gl.bindVertexArray(c.vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, c.vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(m.V), gl.STATIC_DRAW);
  setAttribs();
  const big = m.n > 65535;
  c.type = big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, c.ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(m.I) : new Uint16Array(m.I), gl.STATIC_DRAW);
  gl.bindVertexArray(null);
}
function remeshIf(cx, cz) { const c = chunkMap.get(cx + ',' + cz); if (c && c.meshed) buildMesh(c); }

function setBlock(x, y, z, t) {
  if (y < 0 || y >= CH) return false;
  const cx = x >> 4, cz = z >> 4, key = cx + ',' + cz, lx = x & 15, lz = z & 15, i = (y * CS + lz) * CS + lx;
  let em = editsByChunk.get(key);
  if (!em) editsByChunk.set(key, em = new Map());
  em.set(i, t); saveDirty = true;
  const c = chunkMap.get(key);
  if (!c) return true;
  c.data[i] = t;
  remeshIf(cx, cz);
  if (lx === 0) remeshIf(cx - 1, cz);
  if (lx === CS - 1) remeshIf(cx + 1, cz);
  if (lz === 0) remeshIf(cx, cz - 1);
  if (lz === CS - 1) remeshIf(cx, cz + 1);
  return true;
}

// ---------- Streaming de chunks ----------
let OFFS = [];
function applyRD() {
  const r = RD + 1; OFFS = [];
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= (r + 0.5) * (r + 0.5)) OFFS.push([dx, dz]);
  OFFS.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));
  gl.uniform1f(locFogD, 3.2 / (RD * CS));
}
let lastUnloadCx = 1e9, lastUnloadCz = 1e9;
function streamChunks() {
  const pcx = Math.floor(player.x / CS), pcz = Math.floor(player.z / CS), t0 = performance.now();
  let did = 0;
  for (const [dx, dz] of OFFS) {
    if (did && performance.now() - t0 > 7) break;
    const cx = pcx + dx, cz = pcz + dz, key = cx + ',' + cz;
    let c = chunkMap.get(key);
    if (!c) { loadChunk(cx, cz); did++; continue; }
    if (!c.meshed && dx * dx + dz * dz <= (RD + 0.5) * (RD + 0.5) && atlasTex &&
        chunkMap.has((cx - 1) + ',' + cz) && chunkMap.has((cx + 1) + ',' + cz) && chunkMap.has(cx + ',' + (cz - 1)) && chunkMap.has(cx + ',' + (cz + 1))) {
      buildMesh(c); did++;
    }
  }
  if (pcx !== lastUnloadCx || pcz !== lastUnloadCz) {
    lastUnloadCx = pcx; lastUnloadCz = pcz;
    for (const [k, c] of chunkMap) if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > RD + 2) { freeChunk(c); chunkMap.delete(k); }
  }
}

// ---------- Inventario ----------
const inv = { slots: new Array(36).fill(null), sel: 0, hand: null, open: false, mode: 'survival' };
const RECIPES = [
  { name: '1 Tronco → 4 Tablones', need: { 5: 1 }, out: [6, 4] },
  { name: '2 Arena → 1 Vidrio', need: { 8: 2 }, out: [10, 1] },
  { name: '1 Adoquín → 1 Piedra', need: { 11: 1 }, out: [4, 1] }
];
function invInit(mode, sv) {
  inv.mode = mode; inv.hand = null; inv.open = false;
  inv.slots = new Array(36).fill(null);
  if (sv && sv.inv) { inv.slots = sv.inv.slice(0, 36); while (inv.slots.length < 36) inv.slots.push(null); inv.sel = sv.sel || 0; }
  else {
    inv.sel = 0;
    if (mode === 'creative') [6, 3, 4, 5, 8, 10, 11, 1, 7].forEach((id, i) => { inv.slots[i] = { id, n: 64 }; });
  }
}
function invAdd(id, n) {
  for (let i = 0; i < 36 && n > 0; i++) { const s = inv.slots[i]; if (s && s.id === id && s.n < 64) { const m = Math.min(64 - s.n, n); s.n += m; n -= m; } }
  for (let i = 0; i < 36 && n > 0; i++) if (!inv.slots[i]) { const m = Math.min(64, n); inv.slots[i] = { id, n: m }; n -= m; }
  renderInv(); saveDirty = true;
  return n;
}
function invCount(id) { let t = 0; for (const s of inv.slots) if (s && s.id === id) t += s.n; return t; }
function invTake(id, n) {
  for (let i = 35; i >= 0 && n > 0; i--) { const s = inv.slots[i]; if (s && s.id === id) { const m = Math.min(s.n, n); s.n -= m; n -= m; if (s.n <= 0) inv.slots[i] = null; } }
}
function craft(i) {
  const r = RECIPES[i];
  for (const id in r.need) if (invCount(+id) < r.need[id]) return;
  for (const id in r.need) invTake(+id, r.need[id]);
  invAdd(r.out[0], r.out[1]);
}
function slotClick(i) {
  const s = inv.slots[i], h = inv.hand;
  if (!h) { if (s) { inv.hand = s; inv.slots[i] = null; } }
  else if (!s) { inv.slots[i] = h; inv.hand = null; }
  else if (s.id === h.id) { const m = Math.min(64 - s.n, h.n); s.n += m; h.n -= m; if (h.n <= 0) inv.hand = null; }
  else { inv.slots[i] = h; inv.hand = s; }
  renderInv(); saveDirty = true;
}
// Íconos de bloque (cubo isométrico dibujado desde el atlas)
const icons = {};
function icon(id) {
  if (icons[id] !== undefined) return icons[id];
  if (!atlasCanvas) return '';
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const tile = t => { const k = t - 1; return [(k % COLS) * TILE, Math.floor(k / COLS) * TILE]; };
  const face = (t, m, poly, shade) => {
    const [sx, sy] = tile(t);
    x.setTransform(m[0] / 64, m[1] / 64, m[2] / 64, m[3] / 64, m[4], m[5]);
    x.drawImage(atlasCanvas, sx, sy, TILE, TILE, 0, 0, 64, 64);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = 'rgba(0,0,0,' + shade + ')'; x.beginPath();
    poly.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fill();
  };
  face(faceTex(id, 2), [13, 7.5, -13, 7.5, 16, 3], [[16, 3], [29, 10.5], [16, 18], [3, 10.5]], 0);
  face(faceTex(id, 0), [13, 7.5, 0, 13, 3, 10.5], [[3, 10.5], [16, 18], [16, 31], [3, 23.5]], 0.28);
  face(faceTex(id, 0), [13, -7.5, 0, 13, 16, 18], [[16, 18], [29, 10.5], [29, 23.5], [16, 31]], 0.5);
  return (icons[id] = c.toDataURL());
}
function slotHTML(i, sel) {
  const s = inv.slots[i];
  return '<div class="slot' + (sel ? ' sel' : '') + '" data-i="' + i + '">' +
    (s ? '<img src="' + icon(s.id) + '">' + (inv.mode === 'survival' && s.n > 1 ? '<span class="cnt">' + s.n + '</span>' : '') : '') + '</div>';
}
function renderInv() {
  let h = '';
  for (let i = 0; i < 9; i++) h += slotHTML(i, i === inv.sel);
  $('hotbar').innerHTML = h;
  if (!inv.open) return;
  let g = '', t = '';
  for (let i = 9; i < 36; i++) g += slotHTML(i, false);
  for (let i = 0; i < 9; i++) t += slotHTML(i, i === inv.sel);
  $('invGrid').innerHTML = g; $('invHot').innerHTML = t;
  $('invHand').innerHTML = inv.hand ? 'En mano: <img src="' + icon(inv.hand.id) + '"> ' + BLOCK_NAMES[inv.hand.id] + ' ×' + inv.hand.n + ' <button class="mcBtn small secondary" data-act="trash">🗑 Tirar</button>' : 'En mano: —';
  $('invPalette').style.display = inv.mode === 'creative' ? '' : 'none';
  $('invPalette').innerHTML = inv.mode === 'creative' ? CREATIVE_LIST.map(id => '<div class="slot" data-pal="' + id + '" title="' + BLOCK_NAMES[id] + '"><img src="' + icon(id) + '"></div>').join('') : '';
  $('invCraft').innerHTML = RECIPES.map((r, i) => {
    const ok = Object.keys(r.need).every(id => invCount(+id) >= r.need[id]);
    return '<button class="mcBtn small' + (ok ? '' : ' disabled') + '" data-craft="' + i + '">' + r.name + '</button>';
  }).join('');
}
$('hotbar').addEventListener('click', e => { const s = e.target.closest('.slot'); if (s) { inv.sel = +s.dataset.i; renderInv(); } });
$('invScreen').addEventListener('click', e => {
  const s = e.target.closest('.slot'), b = e.target.closest('button');
  if (s && s.dataset.pal) { inv.hand = { id: +s.dataset.pal, n: 64 }; renderInv(); }
  else if (s && s.dataset.i !== undefined) slotClick(+s.dataset.i);
  else if (b && b.dataset.craft !== undefined) craft(+b.dataset.craft);
  else if (b && b.dataset.act === 'trash') { inv.hand = null; renderInv(); }
});
const invUI = {
  toggle() { if (inv.open) this.close(); else this.openIt(); },
  openIt() {
    if (!engine.playing || engine.loading) return;
    if (document.pointerLockElement) document.exitPointerLock();
    inv.open = true; ui.show('invScreen'); renderInv();
  },
  close() {
    if (inv.hand) { invAdd(inv.hand.id, inv.hand.n); inv.hand = null; }
    inv.open = false; ui.hide(); renderInv();
  },
  exitToMenu() {
    this.close(); saveWorld(); engine.playing = false; clearWorld(); ui.show('menuMain');
    if (document.pointerLockElement) document.exitPointerLock();
  }
};

// ---------- Jugador / Física ----------
const player = { x: 0.5, y: 40, z: 0.5, vy: 0, yaw: 0, pitch: -0.3, onGround: false, name: 'Jugador' };
let spawn = [0.5, 40, 0.5];
const input = { forward: 0, right: 0, jump: 0, place: false, break: false };
const act = { cd: 0 };
const keys = {};

function collides(px, py, pz) {
  const r = 0.3;
  for (let x = Math.floor(px - r); x <= Math.floor(px + r); x++)
    for (let y = Math.floor(py); y <= Math.floor(py + 1.79); y++)
      for (let z = Math.floor(pz - r); z <= Math.floor(pz + r); z++)
        if (isSolid(gx(x, y, z))) return true;
  return false;
}
function getDir() { return [Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch)]; }
function raycast(dist) {
  const f = getDir();
  let px = player.x, py = player.y + EYE, pz = player.z, lx = 0, ly = -1, lz = 0;
  for (let s = 0; s < dist * 20; s++) {
    const x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz);
    if (isSolid(gx(x, y, z))) return { hit: true, x, y, z, lx, ly, lz };
    lx = x; ly = y; lz = z; px += f[0] * 0.05; py += f[1] * 0.05; pz += f[2] * 0.05;
  }
  return { hit: false };
}
function doBreak() {
  const h = raycast(6);
  if (!h.hit) return;
  const t = gx(h.x, h.y, h.z);
  if (t === B.BEDROCK) return;
  setBlock(h.x, h.y, h.z, 0);
  if (inv.mode === 'survival') { const d = DROP[t] !== undefined ? DROP[t] : t; if (d) invAdd(d, 1); }
  if (net.active) net.sendBreak(h.x, h.y, h.z);
}
function doPlace() {
  const s = inv.slots[inv.sel];
  if (!s) return;
  const h = raycast(6);
  if (!h.hit || h.ly < 0) return;
  const prev = gx(h.lx, h.ly, h.lz);
  setBlock(h.lx, h.ly, h.lz, s.id);
  if (collides(player.x, player.y, player.z)) { setBlock(h.lx, h.ly, h.lz, prev); return; }   // no te encierres
  if (inv.mode === 'survival') { s.n--; if (s.n <= 0) inv.slots[inv.sel] = null; renderInv(); }
  if (net.active) net.sendPlace(h.lx, h.ly, h.lz, s.id);
}

// ---------- Entrada ----------
const playing = () => engine.playing && !engine.loading;
window.addEventListener('keydown', e => {
  if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  keys[e.code] = 1;
  if (e.code === 'Escape') { if (inv.open) invUI.close(); else if (document.pointerLockElement) document.exitPointerLock(); else if (playing()) cv.requestPointerLock(); }
  if (e.code === 'KeyE' && playing()) invUI.toggle();
  if (/^Digit[1-9]$/.test(e.code) && playing()) { inv.sel = +e.code[5] - 1; renderInv(); }
});
window.addEventListener('keyup', e => { keys[e.code] = 0; });
window.addEventListener('wheel', e => { if (playing() && !inv.open) { inv.sel = (inv.sel + (e.deltaY > 0 ? 1 : 8)) % 9; renderInv(); } });
cv.addEventListener('click', () => { if (playing() && !inv.open && !matchMedia('(pointer:coarse)').matches) cv.requestPointerLock(); });
window.addEventListener('mousemove', e => {
  if (document.pointerLockElement) {
    player.yaw += e.movementX * 0.0025;
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0025));
  }
});
window.addEventListener('mousedown', e => {
  if (!document.pointerLockElement) return;
  act.cd = 0;
  if (e.button === 0) input.break = true;
  if (e.button === 2) input.place = true;
});
window.addEventListener('mouseup', e => { if (e.button === 0) input.break = false; if (e.button === 2) input.place = false; });
window.addEventListener('contextmenu', e => e.preventDefault());
$('btnInv').addEventListener('click', () => invUI.toggle());

let touchOn = true;
if (matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');
const touch = { joyId: null, lookId: null, sx: 0, sy: 0, lx: 0, ly: 0 };
const clamp1 = v => Math.max(-1, Math.min(1, v));
const onUI = t => t.target.closest && t.target.closest('#hotbar,#invScreen,#btnInv');
window.addEventListener('touchstart', e => {
  if (touchOn) document.body.classList.add('touch');
  for (const t of e.changedTouches) {
    if (onUI(t)) continue;
    const id = t.target.id;
    if (id === 'btnUp') input.forward = 1;
    else if (id === 'btnDown') input.forward = -1;
    else if (id === 'btnLeft') input.right = -1;
    else if (id === 'btnRight') input.right = 1;
    else if (id === 'btnJump') input.jump = 1;
    else if (id === 'btnPlace') { act.cd = 0; input.place = true; }
    else if (id === 'btnBreak') { act.cd = 0; input.break = true; }
    else if (t.clientX < innerWidth * 0.4 && touch.joyId === null) { touch.joyId = t.identifier; touch.sx = t.clientX; touch.sy = t.clientY; }
    else if (touch.lookId === null) { touch.lookId = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY; }
  }
}, { passive: false });
window.addEventListener('touchmove', e => {
  if (!(e.target.closest && e.target.closest('#invScreen'))) e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === touch.joyId) {
      input.right = clamp1((t.clientX - touch.sx) / 60);
      input.forward = clamp1(-(t.clientY - touch.sy) / 60);
    } else if (t.identifier === touch.lookId) {
      player.yaw += (t.clientX - touch.lx) * 0.005;
      player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - (t.clientY - touch.ly) * 0.005));
      touch.lx = t.clientX; touch.ly = t.clientY;
    }
  }
}, { passive: false });
function touchEnd(e) {
  for (const t of e.changedTouches) {
    const id = t.target.id;
    if (id === 'btnUp' || id === 'btnDown') input.forward = 0;
    if (id === 'btnLeft' || id === 'btnRight') input.right = 0;
    if (id === 'btnJump') input.jump = 0;
    if (id === 'btnPlace') input.place = false;
    if (id === 'btnBreak') input.break = false;
    if (t.identifier === touch.joyId) { touch.joyId = null; input.forward = 0; input.right = 0; }
    if (t.identifier === touch.lookId) touch.lookId = null;
  }
}
window.addEventListener('touchend', touchEnd);
window.addEventListener('touchcancel', touchEnd);

$('chkFps').addEventListener('change', e => { $('hud').style.display = e.target.checked ? '' : 'none'; });
$('chkTouch').addEventListener('change', e => {
  touchOn = e.target.checked;
  if (!touchOn) document.body.classList.remove('touch');
  else if (matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');
});
$('selRD').value = matchMedia('(pointer:coarse)').matches ? '3' : '5';
$('selRD').addEventListener('change', e => { RD = +e.target.value || 3; applyRD(); });

// ---------- Matrices ----------
function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
  return o;
}
function persp(fv, a, n, f) {
  const t = 1 / Math.tan(fv / 2);
  return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]);
}
function look(e, yw, pt) {
  const sy = Math.sin(yw), cy = Math.cos(yw), sp = Math.sin(pt), cp = Math.cos(pt);
  const f = [sy * cp, sp, -cy * cp], r = [cy, 0, sy], u = [-sy * sp, cp, cy * sp], d = v => v[0] * e[0] + v[1] * e[1] + v[2] * e[2];
  return new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -d(r), -d(u), d(f), 1]);
}
function frustum(m) {
  const p = [];
  for (let i = 0; i < 3; i++) for (const s of [1, -1]) {
    const a = m[3] + s * m[i], b = m[7] + s * m[4 + i], c = m[11] + s * m[8 + i], d = m[15] + s * m[12 + i], l = Math.hypot(a, b, c);
    p.push([a / l, b / l, c / l, d / l]);
  }
  return p;
}

// ---------- Otros jugadores (cajas) ----------
const BOXF = [   // esquina: x y z s t  (giro antihorario visto desde afuera)
  [[1,0,0,1,1],[1,1,0,1,0],[1,1,1,0,0],[1,0,1,0,1]], [[0,0,1,1,1],[0,1,1,1,0],[0,1,0,0,0],[0,0,0,0,1]],
  [[0,1,1,0,0],[1,1,1,1,0],[1,1,0,1,1],[0,1,0,0,1]], [[0,0,0,0,0],[1,0,0,1,0],[1,0,1,1,1],[0,0,1,0,1]],
  [[1,0,1,1,1],[1,1,1,1,0],[0,1,1,0,0],[0,0,1,0,1]], [[0,0,0,1,1],[0,1,0,1,0],[1,1,0,0,0],[1,0,0,0,1]]
];
const pvao = gl.createVertexArray(), pvb = gl.createBuffer(), pib = gl.createBuffer();
gl.bindVertexArray(pvao);
gl.bindBuffer(gl.ARRAY_BUFFER, pvb); setAttribs();
const pind = []; for (let f = 0; f < 6; f++) pind.push(f * 4, f * 4 + 1, f * 4 + 2, f * 4, f * 4 + 2, f * 4 + 3);
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pib);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(pind), gl.STATIC_DRAW);
gl.bindVertexArray(null);
function drawPlayers() {
  if (typeof net === 'undefined' || !net.active) return;
  let first = true;
  gl.uniform3f(locO, 0, 0, 0);
  for (const id in net.players) {
    const p = net.players[id], V = [];
    for (let f = 0; f < 6; f++) for (let m = 0; m < 4; m++) {
      const q = BOXF[f][m];
      V.push(p.x - 0.3 + q[0] * 0.6, p.y + q[1] * 1.8, p.z - 0.3 + q[2] * 0.6, q[3], q[4], 5, FSH[f]);
    }
    if (first) { gl.bindVertexArray(pvao); first = false; }
    gl.bindBuffer(gl.ARRAY_BUFFER, pvb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.DYNAMIC_DRAW);
    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
  }
}

// ---------- Guardado ----------
function saveWorld() {
  if (!engine.worldName) return;
  const edits = {};
  editsByChunk.forEach((m, k) => { const a = []; m.forEach((b, i) => a.push(i, b)); edits[k] = a; });
  const data = { v: 2, seed: SEED, type: WTYPE, mode: inv.mode, edits, inv: inv.slots, sel: inv.sel,
    p: { x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: player.pitch } };
  try { localStorage.setItem(SAVE_PREFIX + engine.worldName, JSON.stringify(data)); saveDirty = false; }
  catch (e) { console.warn('No se pudo guardar el mundo:', e); }
}
window.addEventListener('beforeunload', saveWorld);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveWorld(); });

// ---------- Motor ----------
let last = performance.now(), frames = 0, fpsTime = last, sc = 0.7, lastDraws = 0, saveTimer = 0;
const engine = {
  started: false, playing: false, loading: false, worldName: null,
  start(mode, opts) {
    opts = opts || {};
    ui.show('loading');
    $('loadTxt').textContent = 'Generando mundo…';
    const s = String(opts.seed || ''), sv = opts.save || null;
    SEED = s ? (/^\d+$/.test(s) ? parseInt(s, 10) % 100000 : strSeed(s)) : Math.floor(Math.random() * 100000);
    WTYPE = opts.type || 'normal';
    engine.worldName = mode === 'single' ? (opts.name || 'Mi Mundo') : null;
    clearWorld();
    editsByChunk.clear();
    if (sv && sv.edits) for (const k in sv.edits) { const m = new Map(), a = sv.edits[k]; for (let i = 0; i < a.length; i += 2) m.set(a[i], a[i + 1]); editsByChunk.set(k, m); }
    invInit(opts.mode || 'survival', sv);
    RD = +$('selRD').value || 3; applyRD();
    if (sv && sv.p) { player.x = sv.p.x; player.y = sv.p.y; player.z = sv.p.z; player.yaw = sv.p.yaw; player.pitch = sv.p.pitch; }
    else { const sp = findSpawn(); player.x = sp[0]; player.y = sp[1]; player.z = sp[2]; player.yaw = 0; player.pitch = -0.2; }
    player.vy = 0; spawn = [player.x, player.y, player.z];
    lastUnloadCx = lastUnloadCz = 1e9;
    renderInv();
    engine.loading = true; engine.playing = true; saveDirty = false; saveTimer = 0;
    if (!engine.started) { engine.started = true; last = performance.now(); requestAnimationFrame(frame); }
  }
};
function checkLoaded() {
  const pcx = Math.floor(player.x / CS), pcz = Math.floor(player.z / CS);
  let ok = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c = chunkMap.get((pcx + dx) + ',' + (pcz + dz)); if (c && c.meshed) ok++; }
  $('loadFill').style.width = (ok / 9 * 100) + '%';
  if (ok === 9) { engine.loading = false; ui.hide(); }
}
function physics(dt) {
  if (!chunkMap.has((Math.floor(player.x / CS)) + ',' + (Math.floor(player.z / CS)))) return;
  let ix = 0, iz = 0;
  if (!inv.open) { ix = input.right + (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); iz = input.forward + (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0); }
  const len = Math.hypot(ix, iz);
  if (len > 1) { ix /= len; iz /= len; }
  const inWater = gx(Math.floor(player.x), Math.floor(player.y + 0.4), Math.floor(player.z)) === B.WATER;
  const sp = SPEED * (inWater ? 0.6 : 1), sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const nx = player.x + (sy * iz + cy * ix) * sp * dt; if (!collides(nx, player.y, player.z)) player.x = nx;
  const nz = player.z + (-cy * iz + sy * ix) * sp * dt; if (!collides(player.x, player.y, nz)) player.z = nz;
  const jmp = !inv.open && (input.jump || keys.Space);
  if (inWater) { player.vy = Math.max(player.vy - GRAVITY * 0.25 * dt, -3); if (jmp) player.vy = 3.8; }
  else { if (jmp && player.onGround) { player.vy = JUMP; player.onGround = false; } player.vy = Math.max(player.vy - GRAVITY * dt, -TERMINAL); }
  const ny = player.y + player.vy * dt;
  if (!collides(player.x, ny, player.z)) { player.y = ny; player.onGround = false; }
  else { if (player.vy < 0) { player.y = Math.floor(ny) + 1; player.onGround = true; } player.vy = 0; }
  if (player.y < -30) { player.x = spawn[0]; player.y = spawn[1] + 5; player.z = spawn[2]; player.vy = 0; }
  if (!inv.open) {
    act.cd -= dt;
    if (input.break && act.cd <= 0) { doBreak(); act.cd = 0.22; }
    if (input.place && act.cd <= 0) { doPlace(); act.cd = 0.22; }
  }
}
const DIRS = ['N', 'E', 'S', 'O'];
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  frames++;
  if (!engine.playing) return;
  streamChunks();
  if (engine.loading) checkLoaded(); else physics(dt);

  saveTimer += dt;
  if (saveTimer > 20) { saveTimer = 0; if (saveDirty || engine.worldName) saveWorld(); }

  if (now - fpsTime >= 1000) {
    if (frames < 27 && sc > 0.35) sc = Math.max(0.35, sc - 0.1);
    else if (frames < 20 && sc <= 0.35 && RD > 2) { RD--; applyRD(); }
    else if (frames > 57 && sc < 1) sc = Math.min(1, sc + 0.05);
    const dir = DIRS[((Math.round(player.yaw / (Math.PI / 2)) % 4) + 4) % 4];
    $('hud').textContent = 'FPS ' + frames + ' | Res ' + Math.round(sc * 100) + '% | Chunks ' + lastDraws + (net.active ? ' | Online' : '') +
      '\nX ' + Math.floor(player.x) + '  Y ' + Math.floor(player.y) + '  Z ' + Math.floor(player.z) + '  | ' + dir;
    frames = 0; fpsTime = now;
  }

  const r = sc * (devicePixelRatio || 1);
  const w = Math.max(160, innerWidth * r | 0), h = Math.max(100, innerHeight * r | 0);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const cam = [player.x, player.y + EYE, player.z];
  const under = gx(Math.floor(cam[0]), Math.floor(cam[1]), Math.floor(cam[2])) === B.WATER;
  if (under) { gl.clearColor(0.1, 0.25, 0.55, 1); gl.uniform3f(locFogC, 0.1, 0.25, 0.55); gl.uniform1f(locFogD, 0.12); }
  else { gl.clearColor(0.5, 0.7, 0.9, 1); gl.uniform3f(locFogC, 0.5, 0.7, 0.9); gl.uniform1f(locFogD, 3.2 / (RD * CS)); }
  gl.viewport(0, 0, w, h);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (!atlasTex) return;
  const VP = mul(persp(1.1, w / h, 0.1, RD * CS + 48), look(cam, player.yaw, player.pitch));
  const planes = frustum(VP);
  gl.uniformMatrix4fv(locMvp, false, VP);
  gl.uniform3fv(locCam, cam);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  const pcx = Math.floor(player.x / CS), pcz = Math.floor(player.z / CS);
  let dc = 0;
  for (const c of chunkMap.values()) {
    if (!c.count) continue;
    if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > RD) continue;
    const xw = c.cx * CS + 8, zw = c.cz * CS + 8;
    let vis = true;
    for (const pl of planes) if (pl[0] * xw + pl[1] * 36 + pl[2] * zw + pl[3] < -46) { vis = false; break; }
    if (!vis) continue;
    gl.uniform3f(locO, c.cx * CS, 0, c.cz * CS);
    gl.bindVertexArray(c.vao);
    gl.drawElements(gl.TRIANGLES, c.count, c.type, 0);
    dc++;
  }
  drawPlayers();
  lastDraws = dc;
}

window.__voxel = { setBlock: (x, y, z, t) => setBlock(x, y, z, t), player };

# VoxelCraft — Instrucciones definitivas

## Estructura del proyecto
```
minecraf optimizado/
├── index.html          → Menús: Jugar, Crear mundo, Multijugador, Opciones
├── style.css           → Estética estilo Minecraft
├── game.js             → Motor WebGL2 + generación procedural
├── network.js          → Cliente online (WebSocket)
├── server.js           → Servidor online (Node.js)
├── package.json        → Config Electron para .exe
├── electron-main.js    → Entrada Electron
├── electron-preload.js → Puente Electron
├── textures/           → Texturas del ntpack-32x (ya copiadas)
├── INSTALAR-DEPS.bat   → Instala dependencias (NO se cierra solo)
├── JUGAR.bat           → Inicia servidor y abre el juego (NO se cierra solo)
├── CREAR-EXE.bat       → Genera el .exe para Windows (NO se cierra solo)
├── BUSCAR-EXE.bat      → Encuentra y abre tu .exe
├── DIAGNOSTICAR.bat    → Revisa si todo está bien instalado
└── INSTRUCCIONES.md
```

---

## Paso 1: Instalar Node.js (si no lo tienes)

1. Ve a https://nodejs.org/
2. Descarga e instala la versión **LTS** (la recomendada).
3. **Reinicia tu PC** después de instalar.

---

## Paso 2: Instalar dependencias

Haz doble clic en:
```
INSTALAR-DEPS.bat
```

Esta ventana **no se cierra sola**. Espera a que diga:
```
DEPENDENCIAS INSTALADAS CORRECTAMENTE
```
Luego presiona cualquier tecla para cerrar.

---

## Paso 3: Jugar

Haz doble clic en:
```
JUGAR.bat
```

Esta ventana **no se cierra solo**. Verás:
1. Se inicia el servidor (ventana negra — NO la cierres)
2. Se abre tu navegador en `http://localhost:3000`
3. Verás el menú: **Jugar → Crear mundo → Multijugador → Opciones**

En **Jugar → Crear mundo**:
- Escribe un nombre para tu mundo
- Opcional: pon una semilla
- Elige tipo: Normal, Superplano o Amplificado
- Pulsa **Crear mundo**

El mundo se genera proceduralmente (biomas, árboles, cuevas).

### Controles
| Acción | PC | Táctil |
|--------|----|--------|
| Mover | WASD | Botones ◀ ▶ ▲ ▼ (izquierda) |
| Mirar | Ratón | Deslizar zona derecha |
| Saltar | Espacio | Botón Saltar |
| Romper bloque | Click izquierdo | Botón ⛏ |
| Colocar bloque | Click derecho | Botón 🧱 |
| Capturar/liberar ratón | Esc | — |
| Chat | Enter | — |

---

## Paso 4: Modo online (multijugador)

1. En una terminal ejecuta: `node server.js`
2. En el juego ve a **Multijugador**
3. Pon `ws://localhost:3000` (o la IP de tu PC si juegas desde otro celular)
4. Pulsa **Conectar**

---

## Paso 5: Crear .exe para Windows

Haz doble clic en:
```
CREAR-EXE.bat
```

Esta ventana **no se cierra solo**. Espera a que termine (pueden ser varios minutos la primera vez).

Tu `.exe` quedará en:
```
dist\win-unpacked\VoxelCraft.exe
```
O como instalador en:
```
dist\VoxelCraft Setup 1.0.0.exe
```

---

## Paso 6: Crear .apk para Android (Motorola E13)

Necesitas [Android Studio](https://developer.android.com/studio).

```powershell
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init VoxelCraft com.voxelcraft.game
npx cap add android
npx cap copy
npx cap open android
```

En Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

---

## ¿Algo falla?

Si cualquier ventana `.bat` marca error, no se cierra sola — te mostrará el mensaje. Además se crean archivos de log:

- `install-log.txt` — errores al instalar dependencias
- `server-log.txt` — errores al iniciar el servidor
- `pack-log.txt` — errores al crear el .exe

Copia el contenido de esos archivos y compártelos para obtener ayuda.

También puedes ejecutar:
```
DIAGNOSTICAR.bat
```
para revisar qué falta en tu sistema.

---

## Optimizaciones para Motorola E13

- Render distance bajo (3 chunks)
- Sin antialiasing, texturas pixeladas (NEAREST)
- Resolución adaptativa (0.7× dpr por defecto)
- WebGL2 con un solo atlas de texturas (menos cambios de GPU)
- Carga progresiva de chunks (no congela al iniciar)
- Máximo 2 GB de RAM objetivo

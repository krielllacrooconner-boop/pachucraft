@echo off
title VoxelCraft - Diagnostico
cd /d "%~dp0"
echo.
echo ====================================
echo  DIAGNOSTICO DEL SISTEMA
echo ====================================
echo.

echo 1. Verificando Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo   [ERROR] Node.js no esta instalado o no esta en el PATH.
    echo   Solucion: Instala Node.js desde https://nodejs.org/
) else (
    echo   [OK] Node.js version:
    node --version
)

echo.
echo 2. Verificando npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo   [ERROR] npm no esta disponible.
) else (
    echo   [OK] npm version:
    npm --version
)

echo.
echo 3. Verificando archivos del proyecto...
if exist "index.html"       (echo   [OK] index.html)       else (echo   [FALTA] index.html)
if exist "game.js"          (echo   [OK] game.js)          else (echo   [FALTA] game.js)
if exist "network.js"       (echo   [OK] network.js)       else (echo   [FALTA] network.js)
if exist "server.js"        (echo   [OK] server.js)        else (echo   [FALTA] server.js)
if exist "style.css"        (echo   [OK] style.css)        else (echo   [FALTA] style.css)
if exist "package.json"     (echo   [OK] package.json)     else (echo   [FALTA] package.json)
if exist "textures\grass_top.png" (echo   [OK] Texturas cargadas) else (echo   [FALTA] Texturas)

echo.
echo 4. Verificando node_modules...
if exist "node_modules\ws"          (echo   [OK] ws instalado)          else (echo   [FALTA] ws - ejecuta INSTALAR-DEPS.bat)
if exist "node_modules\electron"    (echo   [OK] electron instalado)    else (echo   [FALTA] electron)

echo.
echo 5. Verificando logs previos...
if exist "install-log.txt" (
    echo   [INFO] install-log.txt existe (ultimas lineas):
    type install-log.txt | more
) else (
    echo   [INFO] No hay install-log.txt
)

if exist "server-log.txt" (
    echo   [INFO] server-log.txt existe (ultimas lineas):
    type server-log.txt | more
) else (
    echo   [INFO] No hay server-log.txt
)

echo.
echo ====================================
pause

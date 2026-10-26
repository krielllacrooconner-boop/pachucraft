@echo off
title VoxelCraft - Jugar
cd /d "%~dp0"
echo.
echo ====================================
echo  VoxelCraft - Iniciando juego
echo ====================================
echo.
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js no esta instalado.
    echo Instalalo desde https://nodejs.org/ y reinicia tu PC.
    echo.
    pause
    exit /b
)
if not exist "node_modules\ws" (
    echo ERROR: Faltan las dependencias.
    echo Ejecuta primero INSTALAR-DEPS.bat
    echo.
    pause
    exit /b
)
echo Iniciando servidor en el puerto 3000...
start "Servidor VoxelCraft" cmd /k node server.js
timeout /t 3 >nul
start "" "http://localhost:3000"
echo.
echo El servidor quedo abierto en otra ventana negra.
echo NO la cierres mientras juegas.
echo.
pause

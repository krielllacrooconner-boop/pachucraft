@echo off
title VoxelCraft - Instalar dependencias
cd /d "%~dp0"
echo.
echo ====================================
echo  VoxelCraft - Instalar dependencias
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
echo [OK] Node.js encontrado:
node --version
echo.
echo Instalando dependencias (puede tardar unos minutos)...
echo.
call npm install >> install-log.txt 2>&1
if errorlevel 1 (
    echo ERROR al instalar. Revisa install-log.txt
    echo.
    pause
    exit /b
)
echo [OK] Dependencias instaladas.
if exist "node_modules\electron\install.js" (
    if not exist "node_modules\electron\dist\electron.exe" (
        echo Descargando el binario de Electron...
        node node_modules\electron\install.js
    )
)
echo.
echo ====================================
echo  INSTALACION COMPLETADA
echo ====================================
echo Ahora ejecuta JUGAR.bat
echo.
pause

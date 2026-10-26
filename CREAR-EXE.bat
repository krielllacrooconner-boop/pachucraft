@echo off
title VoxelCraft - Crear EXE
cd /d "%~dp0"
echo.
echo ====================================
echo  VoxelCraft - Generando .EXE
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

echo Paso 1: Instalando dependencias...
call npm install >> install-log.txt 2>&1
if errorlevel 1 (
    echo ERROR al instalar dependencias. Revisa install-log.txt
    echo.
    pause
    exit /b
)
echo [OK] Dependencias instaladas.

echo.
echo Paso 2: Empaquetando como .exe (puede tardar varios minutos)...
call npm run pack-win >> pack-log.txt 2>&1
if errorlevel 1 (
    echo ERROR al empaquetar el .exe. Revisa pack-log.txt
    echo.
    pause
    exit /b
)
echo [OK] Empaquetado completado.

echo.
echo ====================================
echo  LISTO! Tu .exe esta aqui:
echo ====================================
echo.
if exist "dist\win-unpacked\VoxelCraft.exe" (
    echo   dist\win-unpacked\VoxelCraft.exe
)
if exist "dist\VoxelCraft Setup 1.0.0.exe" (
    echo   dist\VoxelCraft Setup 1.0.0.exe
)
echo.
echo Tambien puedes ejecutar BUSCAR-EXE.bat para abrirlo directamente.
echo.
pause

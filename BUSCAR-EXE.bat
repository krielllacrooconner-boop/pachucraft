@echo off
title Buscar EXE de VoxelCraft
cd /d "%~dp0"
echo.
echo ====================================
echo  Buscando ejecutable de VoxelCraft...
echo ====================================
echo.

if exist "dist\win-unpacked\VoxelCraft.exe" (
    echo [ENCONTRADO] dist\win-unpacked\VoxelCraft.exe
    echo Abriendo el juego...
    start "" "dist\win-unpacked\VoxelCraft.exe"
    goto fin
)

if exist "dist\VoxelCraft Setup 1.0.0.exe" (
    echo [ENCONTRADO] dist\VoxelCraft Setup 1.0.0.exe
    echo Abriendo el instalador...
    start "" "dist\VoxelCraft Setup 1.0.0.exe"
    goto fin
)

echo [NO ENCONTRADO] Todavia no se genero el .exe.
echo Ejecuta CREAR-EXE.bat para generarlo.
:fin
echo.
pause

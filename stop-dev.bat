@echo off
title Kleiora - Stop Dev Environment
color 0C

echo.
echo  ==========================================
echo    KLEIORA - Stopping Dev Environment
echo  ==========================================
echo.

:: Stop proses Go (air / server.exe)
echo [1/3] Stopping Backend (Go)...
taskkill /f /im air.exe >nul 2>&1
taskkill /f /im server.exe >nul 2>&1
echo        ^> Backend stopped.

:: Stop proses Node (Next.js)
echo [2/3] Stopping Frontend (Node.js)...
taskkill /f /im node.exe >nul 2>&1
echo        ^> Frontend stopped.

:: Stop MySQL di WSL
echo [3/3] Stopping MySQL in WSL Ubuntu...
wsl -d Ubuntu -- sudo service mysql stop >nul 2>&1
echo        ^> MySQL stopped.

echo.
echo  ==========================================
echo    All services stopped!
echo  ==========================================
echo.
pause

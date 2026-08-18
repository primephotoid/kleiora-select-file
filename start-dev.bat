@echo off
title Kleiora Dev Environment
color 0A

echo.
echo  ==========================================
echo    KLEIORA - Starting Dev Environment
echo  ==========================================
echo.

:: 1. Start MySQL di WSL Ubuntu
echo [1/3] Starting MySQL in WSL Ubuntu...
wsl -d Ubuntu -- sudo service mysql start >nul 2>&1
if %errorlevel% == 0 (
    echo        ^> MySQL started successfully!
) else (
    echo        ^> MySQL already running or failed. Continuing...
)
timeout /t 2 /nobreak >nul

:: 2. Start Backend (Go + Air) di window baru
echo [2/3] Starting Backend (Go Air) on port 4000...
start "Kleiora Backend" cmd /k "cd /d c:\web-form\backend && air"
timeout /t 2 /nobreak >nul

:: 3. Start Frontend (Next.js) di window baru
echo [3/3] Starting Frontend (Next.js) on port 3000...
start "Kleiora Frontend" cmd /k "cd /d c:\web-form\frontend && npm run dev"
timeout /t 2 /nobreak >nul

echo.
echo  ==========================================
echo    All services starting!
echo  ------------------------------------------
echo    Frontend  : http://localhost:3000
echo    Backend   : http://localhost:4000
echo    Database  : [::1]:3306 / 127.0.0.1:3306
echo  ==========================================
echo.
echo  Tutup jendela ini atau tekan tombol apa saja.
pause >nul

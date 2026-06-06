@echo off
title CyberOracle Enterprise Launcher
cls

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║       CyberOracle Enterprise Launcher        ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: 1. Verify PostgreSQL Database Server
echo [1/3] Checking PostgreSQL Database Server (port 5432)...
"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "C:\Program Files\PostgreSQL\18\data" status >nul 2>nul
if %errorlevel% equ 0 goto db_running

echo      PostgreSQL is offline. Starting PostgreSQL Server in background...
"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "C:\Program Files\PostgreSQL\18\data" start >nul 2>nul
ping 127.0.0.1 -n 5 >nul
goto db_done

:db_running
echo      ✓ PostgreSQL is already running.

:db_done

:: 2. Start Backend (FastAPI on port 8000)
echo [2/3] Checking Backend Server (port 8000)...
netstat -ano | findstr /r /c:"127.0.0.1:8000 .*LISTENING" /c:"0.0.0.0:8000 .*LISTENING" >nul
if %errorlevel% equ 0 goto backend_running

echo      Starting Backend (FastAPI)...
start "CyberOracle Enterprise Backend" cmd /k "cd /d D:\CyberOracle-Enterprise\backend && python main.py"
ping 127.0.0.1 -n 4 >nul
goto backend_done

:backend_running
echo      ✓ Backend is already running.

:backend_done

:: 3. Start Frontend (Vite on port 5173)
echo [3/3] Checking Frontend Server (port 5173)...
netstat -ano | findstr /r /c:"127.0.0.1:5173 .*LISTENING" /c:"0.0.0.0:5173 .*LISTENING" >nul
if %errorlevel% equ 0 goto frontend_running

echo      Starting Frontend (Vite)...
start "CyberOracle Enterprise Frontend" cmd /k "cd /d D:\CyberOracle-Enterprise\frontend && npm.cmd run dev"
ping 127.0.0.1 -n 4 >nul
goto frontend_done

:frontend_running
echo      ✓ Frontend is already running.

:frontend_done

:: Open Browser
echo.
echo  Opening dashboard in browser...
start http://127.0.0.1:5173

echo.
echo  ✓ Database  → http://127.0.0.1:5432 (Running in background)
echo  ✓ Backend   → http://127.0.0.1:8000
echo  ✓ Frontend  → http://127.0.0.1:5173
echo.
echo  Press any key to exit this launcher...
pause >nul

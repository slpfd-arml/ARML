@echo off
title ARML Add-Resource Tool
cd /d "%~dp0"

if not exist "node_modules" (
  echo First-time setup - installing dependencies, this only happens once...
  call npm install
  if errorlevel 1 (
    echo.
    echo Setup failed. Make sure Node.js is installed: https://nodejs.org
    pause
    exit /b 1
  )
  echo.
)

echo Starting the ARML Add-Resource Tool...
echo.
echo A browser tab should open automatically. If it shows an error the very
echo first time, just refresh the page - the server takes a moment to start.
echo.
echo To stop the tool, close this window.
echo.

start "" "http://localhost:3000"
node server.js

echo.
echo Server stopped.
pause >nul

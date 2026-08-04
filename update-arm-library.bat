@echo off
title ARM Library Updater

echo ============================================
echo   St. Louis Park Fire ARM Library Updater
echo ============================================
echo.

REM --- Move into ARM-Builder ---
cd /d "%~dp0ARM-Builder"

if not exist build-data.js (
    echo ERROR: build-data.js not found in ARM-Builder.
    echo Make sure this file exists:
    echo   %~dp0ARM-Builder\build-data.js
    pause
    exit /b 1
)

if not exist New_ARM_Library.xlsx (
    echo ERROR: New_ARM_Library.xlsx not found in ARM-Builder.
    echo Make sure the workbook is here:
    echo   %~dp0ARM-Builder\New_ARM_Library.xlsx
    pause
    exit /b 1
)

if not exist node_modules (
    echo Dependencies not installed yet - installing now ^(one-time^)...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo ============================================
        echo   ERROR: npm install failed.
        echo   Make sure Node.js is installed: https://nodejs.org
        echo ============================================
        pause
        exit /b 1
    )
    echo.
)

echo Running builder...
echo.

node build-data.js

REM --- THE ACTUAL FIX ---
REM The old version of this script printed "Build complete!" and launched
REM the app unconditionally, even if node build-data.js had just failed.
REM That meant a broken build could look identical to a successful one,
REM and you could deploy stale or missing data.js/version.json without
REM any indication something was wrong. errorlevel is node's actual exit
REM code - non-zero means it threw, and we stop here instead of
REM continuing.
if errorlevel 1 (
    echo.
    echo ============================================
    echo   BUILD FAILED - see the error above.
    echo   data.js has NOT been updated.
    echo   The app has NOT been launched.
    echo ============================================
    echo.
    echo Common fixes:
    echo   - "Cannot find module 'xlsx'"  -^>  run:  npm install
    echo     ^(from inside the ARM-Builder folder^)
    echo   - Workbook missing or open in Excel  -^>  close Excel and retry
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Build complete!
echo   data.js, version.json, and assets-manifest.json
echo   have been updated.
echo ============================================
echo.

REM --- Open the PWA automatically (only reached on real success) ---
echo Launching ARM Library...
start "" "%~dp0index.html"

pause
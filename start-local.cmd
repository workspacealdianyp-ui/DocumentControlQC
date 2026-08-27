@echo off
title QC Monitor - Local Preview
rem Add the portable Node.js to PATH for this window only
set "PATH=%LOCALAPPDATA%\nodejs-portable\node-v22.17.0-win-x64;%PATH%"
rem Move into this script's own folder (qc-app)
cd /d "%~dp0"
echo.
echo   Starting local preview...
echo   Open in browser:  http://localhost:5173
echo   (Close this window or press Ctrl+C to stop the server)
echo.
call npm run dev
pause

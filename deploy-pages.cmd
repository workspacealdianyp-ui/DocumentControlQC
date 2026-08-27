@echo off
title QC Monitor - Deploy to GitHub Pages
rem Only plain git commands here. No downloads, no bypass, no bulk delete.
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo   [X] Git not found. Install Git first, then run this again.
  echo.
  pause
  exit /b 1
)

rem --- First time only: init repo + point it at your GitHub ---
if not exist ".git" (
  echo   First time setup...
  git init
  git branch -M main
  git remote add origin https://github.com/workspacealdianyp-ui/DocumentControlQC.git
)

rem --- Make sure a remote exists even if .git was already there ---
git remote get-url origin >nul 2>nul || git remote add origin https://github.com/workspacealdianyp-ui/DocumentControlQC.git
rem --- Git identity: set these once with your own details, e.g.
rem     git config --global user.name  "Your Name"
rem     git config --global user.email "you@example.com"

echo.
echo   Staging files...
git add -A

echo   Committing...
git commit -m "Update QC Monitor %date% %time%"

echo   Pushing to GitHub (a login popup may appear the first time)...
git push -u origin main

echo.
echo   ============================================================
echo   Done pushing. GitHub now builds it automatically.
echo.
echo   Watch build : https://github.com/workspacealdianyp-ui/DocumentControlQC/actions
echo   Live site   : https://workspacealdianyp-ui.github.io/DocumentControlQC/
echo   ============================================================
echo.
echo   FIRST TIME ONLY: in the repo, go to
echo   Settings -^> Pages -^> Source = "GitHub Actions"  (set it once)
echo.
pause

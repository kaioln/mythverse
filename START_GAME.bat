@echo off
setlocal
cd /d "%~dp0"
title Mythverse
where node >nul 2>nul
if %errorlevel%==0 (
  echo Iniciando o servidor do Mythverse em http://localhost:8080 ...
  start "" "http://localhost:8080/"
  node server/index.js
  pause
  exit /b 0
)
echo Node.js nao encontrado: abrindo no modo offline (sem contas).
echo Instale o Node.js 24 em https://nodejs.org para jogar com contas e saves na nuvem.
start "Mythverse" "%~dp0index.html"
endlocal

@echo off
chcp 65001 >nul
title Dalala School Server
cd /d "%~dp0"
node server.js --dir "%~dp0..\dalala-data"
pause

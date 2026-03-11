@echo off
set "SCRIPT=%~dp0webui"

cd /d %SCRIPT%
call npm run dev

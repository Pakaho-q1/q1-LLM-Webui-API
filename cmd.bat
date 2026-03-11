@echo off

set "ROOT=%~dp0"
set "SCRIPT=%ROOT%\server"

start cmd /k "cd /d %ROOT% && %ROOT%\env\Scripts\activate.bat"
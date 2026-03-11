@echo off
set "SCRIPT=%~dp0server"

call env\Scripts\activate.bat

cd /d %SCRIPT%
Python main.py
pause
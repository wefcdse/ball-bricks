@echo off
cd /d "%~dp0"
start "" /min cmd /c "timeout /t 1 >nul & start http://localhost:8000/"
python serve.py
if errorlevel 1 pause

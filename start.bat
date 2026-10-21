@echo off
cd /d "%~dp0"
echo Ball and Bricks: http://localhost:8000/
echo Keep this window open. Close it or press Ctrl+C to stop.
start "" /min cmd /c "timeout /t 1 >nul & start http://localhost:8000/"
python -m http.server 8000
if errorlevel 1 pause

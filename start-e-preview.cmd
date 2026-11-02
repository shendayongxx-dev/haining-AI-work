@echo off
cd /d "%~dp0"
echo Open http://127.0.0.1:5174/e-preview.html
call pnpm exec vite --host 127.0.0.1 --port 5174 --strictPort
pause

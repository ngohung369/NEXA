@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Chua cai Node.js. Hay tai ban LTS tai https://nodejs.org roi chay lai file nay.
  pause
  exit /b 1
)
:loop
set ZOLA_SUPERVISED=1
node server.js
echo.
echo May chu da dung. Tu khoi dong lai sau 5 giay... (dong cua so nay de thoat)
timeout /t 5 >nul
goto loop

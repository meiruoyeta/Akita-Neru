@echo off
setlocal
cd /d "%~dp0"
call npm start
exit /b %errorlevel%

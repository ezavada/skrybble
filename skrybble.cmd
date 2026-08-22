@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0skrybble.ps1" %*
exit /b %errorlevel%

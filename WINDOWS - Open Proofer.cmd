@echo off
setlocal

cd /d "%~dp0"

set "APP_PATH=%CD%\Script and Sync Releases\Script and Sync (Windows).exe"

if exist "%APP_PATH%" (
  start "" "%APP_PATH%"
  exit /b 0
)

echo Latest Windows app not found in Script and Sync Releases.
echo.
echo Build it first by double-clicking:
echo   WINDOWS - Build Proofer.cmd
echo.
pause
exit /b 1

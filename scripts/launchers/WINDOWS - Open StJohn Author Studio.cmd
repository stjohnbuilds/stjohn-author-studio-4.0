@echo off
setlocal

cd /d "%~dp0..\.."

set "APP_PATH=%CD%\Script and Sync Releases\StJohn Author Studio (Windows).exe"

if exist "%APP_PATH%" (
  start "" "%APP_PATH%"
  exit /b 0
)

echo Latest Windows app not found in Script and Sync Releases.
echo.
echo Build it first by double-clicking:
echo   WINDOWS - Build StJohn Author Studio.cmd
echo.
pause
exit /b 1

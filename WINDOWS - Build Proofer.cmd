@echo off
setlocal

cd /d "%~dp0"

echo Developer build tool
echo Regular users should open Script and Sync Releases\Script and Sync ^(Windows^).exe instead.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required the first time you build this app.
  echo.
  echo Regular users should not need this.
  echo Install the LTS version from https://nodejs.org/ then double-click this file again.
  start "" "https://nodejs.org/en/download/"
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Please install Node.js LTS, then try again.
  pause
  exit /b 1
)

echo.
echo Building Proofer for Windows. This can take several minutes...
echo This will replace the old release copy in Script and Sync Releases with a fresh build.
echo.
echo To avoid Google Drive corrupting node_modules during Windows builds,
echo this script builds from a temporary local copy.
set "SOURCE_DIR=%CD%"
set "BUILD_DIR=%LOCALAPPDATA%\ScriptAndSyncBuild\source"

if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"
mkdir "%BUILD_DIR%" >nul 2>nul

robocopy "%SOURCE_DIR%" "%BUILD_DIR%" /E /XD node_modules .git dist out .next "Script and Sync Releases" "Save Data" /XF desktop.ini
if errorlevel 8 goto :fail

pushd "%BUILD_DIR%"
call npm install
if errorlevel 1 (
  popd
  goto :fail
)

call npm run release:win
if errorlevel 1 (
  popd
  goto :fail
)
popd

if not exist "%SOURCE_DIR%\Script and Sync Releases" mkdir "%SOURCE_DIR%\Script and Sync Releases"
if not exist "%SOURCE_DIR%\Script and Sync Releases\Old" mkdir "%SOURCE_DIR%\Script and Sync Releases\Old"
for /f %%I in ('powershell -NoProfile -Command "(Get-Date).ToString(\"yyyy-MM-dd HH-mm\")"') do set "ARCHIVE_STAMP=%%I"

if exist "%SOURCE_DIR%\Script and Sync Releases\Script and Sync (Windows).exe" move /Y "%SOURCE_DIR%\Script and Sync Releases\Script and Sync (Windows).exe" "%SOURCE_DIR%\Script and Sync Releases\Old\Script and Sync (Windows) old %ARCHIVE_STAMP%.exe" >nul
if exist "%SOURCE_DIR%\Script and Sync Releases\Script and Sync (Portable).exe" move /Y "%SOURCE_DIR%\Script and Sync Releases\Script and Sync (Portable).exe" "%SOURCE_DIR%\Script and Sync Releases\Old\Script and Sync Portable old %ARCHIVE_STAMP%.exe" >nul
if exist "%SOURCE_DIR%\Script and Sync Releases\Script and Sync Setup.exe" move /Y "%SOURCE_DIR%\Script and Sync Releases\Script and Sync Setup.exe" "%SOURCE_DIR%\Script and Sync Releases\Old\Script and Sync Setup old %ARCHIVE_STAMP%.exe" >nul

copy /Y "%BUILD_DIR%\Script and Sync Releases\Script and Sync (Windows).exe" "%SOURCE_DIR%\Script and Sync Releases\Script and Sync (Windows).exe"
if errorlevel 1 goto :fail
copy /Y "%BUILD_DIR%\Script and Sync Releases\Script and Sync Setup.exe" "%SOURCE_DIR%\Script and Sync Releases\Script and Sync Setup.exe"
if errorlevel 1 goto :fail

echo.
echo Build finished. Your runnable Windows app is in Script and Sync Releases.
echo IMPORTANT: always open the .exe from Script and Sync Releases after rebuilding.
echo Any older .exe elsewhere on the computer will still show the old build.
echo Cleaning temporary source build folders...
if exist "%SOURCE_DIR%\dist" rmdir /s /q "%SOURCE_DIR%\dist"
if exist "%SOURCE_DIR%\.next" rmdir /s /q "%SOURCE_DIR%\.next"
if exist "%SOURCE_DIR%\out" rmdir /s /q "%SOURCE_DIR%\out"
if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"
start "" "%SOURCE_DIR%\Script and Sync Releases"
pause
exit /b 0

:fail
echo.
echo Build failed. Leave this window open and send me the message above.
pause
exit /b 1

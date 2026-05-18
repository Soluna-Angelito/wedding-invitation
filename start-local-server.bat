@echo off
setlocal EnableExtensions

set "PORT=5500"
set "URL=http://localhost:%PORT%/"

pushd "%~dp0" || (
  echo Failed to enter the project folder.
  pause
  exit /b 1
)

where py >nul 2>nul
if not errorlevel 1 (
  set "PYTHON_CMD=py -3"
) else (
  where python >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON_CMD=python"
  ) else (
    echo Python was not found.
    echo Install Python or add it to PATH, then run this file again.
    pause
    popd
    exit /b 1
  )
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { exit 1 }"
if errorlevel 1 (
  echo Port %PORT% is already in use.
  echo Close the existing server, or run stop-local-server.bat if it is a leftover Python http.server.
  pause
  popd
  exit /b 1
)

echo Starting wedding invitation local server...
echo.
echo URL: %URL%
echo.
echo Keep this window open while testing.
echo Close this window or press Ctrl+C to stop the server.
echo.

start "" "%URL%"
%PYTHON_CMD% -m http.server %PORT%

set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%

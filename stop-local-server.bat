@echo off
setlocal EnableExtensions

set "PORT=5500"

echo Looking for a Python http.server on port %PORT%...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$connections = Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue;" ^
  "if (-not $connections) { Write-Host 'No server is listening on port %PORT%.'; exit 0 }" ^
  "$processes = foreach ($connection in $connections) { Get-CimInstance Win32_Process -Filter ('ProcessId=' + $connection.OwningProcess) -ErrorAction SilentlyContinue };" ^
  "$servers = $processes | Where-Object { $_.CommandLine -match 'http\.server' -and $_.Name -match '^(python|python3|py)\.exe$' };" ^
  "if (-not $servers) { Write-Host 'Port %PORT% is in use, but it does not look like the Python local server from this project.'; exit 1 }" ^
  "$servers | Sort-Object ProcessId -Unique | ForEach-Object { Write-Host ('Stopping PID {0}: {1}' -f $_.ProcessId, $_.CommandLine); Stop-Process -Id $_.ProcessId -Force }"

echo.
pause

# Registers (or replaces) a monthly Windows scheduled task that refreshes the
# places data. Run it yourself in PowerShell from the project folder:
#
#   powershell -ExecutionPolicy Bypass -File scripts\register-refresh-task.ps1
#
# Optional: -Day 5 -Time "03:00". The task runs while you are logged in and
# writes to logs\refresh.log. Remove it with:
#
#   schtasks /Delete /TN "LeadRadar monthly places refresh" /F
param(
  [ValidateRange(1, 28)][int]$Day = 5,
  [ValidatePattern('^\d{2}:\d{2}$')][string]$Time = "03:00"
)

$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "refresh-places.cmd"
if (-not (Test-Path $script)) { throw "Missing $script" }

schtasks /Create /TN "LeadRadar monthly places refresh" /SC MONTHLY /D $Day /ST $Time /TR "`"$script`"" /F
if ($LASTEXITCODE -ne 0) { throw "schtasks failed with exit code $LASTEXITCODE" }
Write-Host "Scheduled: day $Day of each month at $Time. Log: logs\refresh.log"

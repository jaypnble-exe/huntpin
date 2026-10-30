@echo off
rem Runs the monthly places refresh and appends output to logs\refresh.log.
rem Used by the scheduled task from scripts\register-refresh-task.ps1.
cd /d "%~dp0.."
if not exist logs mkdir logs
call npm run refresh:places >> logs\refresh.log 2>&1

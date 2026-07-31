@echo off
set "ELECTRON_RUN_AS_NODE="
set "ELECTRON_NO_ATTACH_CONSOLE="
set "SOURCE=%~dp0"
set "TARGET=%LOCALAPPDATA%\MastercardAgent\App"

if /I "%SOURCE%"=="%TARGET%\" goto launch

if not exist "%TARGET%" mkdir "%TARGET%"
robocopy "%SOURCE%." "%TARGET%" /E /XO /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  echo Mastercard Agent could not be copied to the local computer.
  echo Copy the full application folder to Downloads, then try again.
  pause
  exit /b 1
)

:launch
start "" "%TARGET%\Mastercard Agent.exe"

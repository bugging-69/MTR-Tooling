@echo off

set "INSTALLER=%TEMP%\MTRSetup.exe"

powershell -NoProfile -ExecutionPolicy Bypass ^
  -Command "Invoke-WebRequest -Uri 'https://github.com/bugging-69/MTR-Tooling/releases/latest/download/MTR%%20Diagnostic%%20Suite%%20Setup.exe' -OutFile '%INSTALLER%'"

if exist "%INSTALLER%" (
    start "" "%INSTALLER%"
) else (
    echo Failed to download installer.
    pause
)
@echo off
echo Running DevNullifier - Built Version
echo.

if not exist "dist" (
  echo Error: Application not built yet!
  echo Please run build.bat first to build the application.
  echo.
  pause
  exit /b 1
)

echo Looking for executable in dist folder...
echo.

rem Look for the executable in common locations
if exist "dist\win-unpacked\DevNullifier.exe" (
  echo Starting DevNullifier...
  start "" "dist\win-unpacked\DevNullifier.exe"
  ) else if exist "dist\DevNullifier.exe" (
  echo Starting DevNullifier...
  start "" "dist\DevNullifier.exe"
  ) else (
  echo Could not find the built executable.
  echo Please check the dist folder manually.
  echo.
  explorer dist
)

echo.
echo If the application doesn't start, check the dist folder for the executable.
pause

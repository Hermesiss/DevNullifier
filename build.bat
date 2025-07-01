@echo off
echo Building DevNullifier - Electron App
echo.
echo This will build the Vue renderer and package the Electron app...
echo.

echo Step 1: Building Vue renderer...
npm run build:renderer
if %errorlevel% neq 0 (
  echo Error: Failed to build renderer
  pause
  exit /b %errorlevel%
)

echo.
echo Step 2: Building Electron app...
npm run build:main
if %errorlevel% neq 0 (
  echo Error: Failed to build Electron app
  pause
  exit /b %errorlevel%
)

echo.
echo Build completed successfully!
echo Check the 'dist' folder for the built application.
echo.

pause

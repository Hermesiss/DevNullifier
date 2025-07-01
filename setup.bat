@echo off
echo Setting up DevNullifier - Electron Version
echo.
echo This will install all required dependencies...
echo.

echo Installing npm dependencies...
npm install

if %errorlevel% neq 0 (
  echo.
  echo Error: Failed to install dependencies
  echo Please check your internet connection and try again.
  pause
  exit /b %errorlevel%
)

echo.
echo Setup completed successfully!
echo.
echo You can now run:
echo  dev.bat  - Start development mode
echo  build.bat  - Build for production
echo.

pause

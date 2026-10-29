@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 22 or newer, then run this launcher again.
  pause
  exit /b 1
)
where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm is required. Install pnpm, then run this launcher again.
  pause
  exit /b 1
)
if not exist "node_modules\next\package.json" (
  echo Installing project dependencies...
  call pnpm install --frozen-lockfile
  if errorlevel 1 (
    echo Installation failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)
echo.
echo Application Composer - http://127.0.0.1:32187
echo Keep this window open while using the app. Press Ctrl+C to stop.
echo Open the address above in the Chrome or Edge profile with the companion installed.
echo.
call pnpm dev
pause

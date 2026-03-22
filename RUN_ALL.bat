@echo off
REM SmartBlood - Run All Services (Windows Batch)
REM This script starts all necessary services for the SmartBlood application

echo.
echo ========================================
echo SmartBlood - Starting All Services
echo ========================================
echo.

REM Activate Python virtual environment
echo Activating Python virtual environment...
call .venv\Scripts\activate.bat

REM Check Node modules
if not exist "node_modules" (
    echo Installing Node.js dependencies...
    call npm install
)

echo.
echo Starting services...
echo.

REM Start Next.js Dev Server
echo Starting Next.js development server (Port 3000)...
start "Next.js Dev Server" cmd /k "npm run dev"

REM Wait a bit before starting next service
timeout /t 3 /nobreak

REM Start Chatbot API if it exists
if exist "src\ai\chatbot_api.py" (
    echo Starting Chatbot API (Port 5000)...
    start "Chatbot API" cmd /k python src\ai\chatbot_api.py
)

echo.
echo ========================================
echo Services are starting!
echo ========================================
echo.
echo Services running:
echo   * Next.js Web:  http://localhost:3000
echo   * Chatbot API:  http://localhost:5000 (if enabled)
echo.
echo Close any terminal window to stop that service
echo.
pause

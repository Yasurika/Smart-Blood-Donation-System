# SmartBlood - Run All Services
# This script starts all necessary services for the SmartBlood application

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SmartBlood - Starting All Services" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Activate Python virtual environment
Write-Host "Activating Python virtual environment..." -ForegroundColor Yellow
& .\.venv\Scripts\Activate.ps1

# Check if .venv was activated
if ($VIRTUAL_ENV) {
    Write-Host "✓ Python venv activated: $VIRTUAL_ENV" -ForegroundColor Green
} else {
    Write-Host "⚠ Failed to activate Python venv" -ForegroundColor Red
}

# Install/Update Node dependencies if needed
Write-Host ""
Write-Host "Checking Node.js dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
    npm install
}

# Start services in parallel
Write-Host ""
Write-Host "Starting services..." -ForegroundColor Yellow
Write-Host ""

# Terminal 1: Next.js Dev Server
Write-Host "→ Starting Next.js development server (Port 3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WorkingDirectory $PWD

# Wait a bit before starting next service
Start-Sleep -Seconds 3

# Terminal 2: Chatbot API (if it exists)
if (Test-Path "src\ai\chatbot_api.py") {
    Write-Host "→ Starting Chatbot API (Port 5000)..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "python src/ai/chatbot_api.py" -WorkingDirectory $PWD
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ All services are starting!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services running:" -ForegroundColor Yellow
Write-Host "  • Next.js Web:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "  • Chatbot API:  http://localhost:5000 (if enabled)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C in any terminal to stop that service" -ForegroundColor Gray
Write-Host ""

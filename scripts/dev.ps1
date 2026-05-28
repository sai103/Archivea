param(
    [int]$ApiPort = 8000,
    [int]$WebPort = 5173
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$backendDir = Join-Path $repoRoot "backend"
$clientWebDir = Join-Path $repoRoot "client_web"
$venvDir = Join-Path $backendDir ".venv"
$pythonExe = Join-Path $venvDir "Scripts\python.exe"

function Test-CommandExists {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ensure-Backend {
    if (-not (Test-Path $pythonExe)) {
        Write-Host "Creating backend virtual environment..."
        python -m venv $venvDir
    }

    Write-Host "Installing backend dependencies..."
    & $pythonExe -m pip install -r (Join-Path $backendDir "requirements.txt")
}

function Ensure-ClientWeb {
    if (-not (Test-CommandExists "npm.cmd")) {
        throw "npm.cmd was not found. Install Node.js before running this script."
    }

    Write-Host "Installing web dependencies..."
    Push-Location $clientWebDir
    try {
        npm ci
    }
    finally {
        Pop-Location
    }
}

Ensure-Backend
Ensure-ClientWeb

Write-Host "Starting Archivea API on http://127.0.0.1:$ApiPort"
$apiProcess = Start-Process `
    -FilePath $pythonExe `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "$ApiPort") `
    -WorkingDirectory $backendDir `
    -PassThru

Write-Host "Starting Archivea Web on http://localhost:$WebPort"
$webProcess = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev", "--", "--host", "0.0.0.0", "--port", "$WebPort") `
    -WorkingDirectory $clientWebDir `
    -PassThru

Write-Host ""
Write-Host "Archivea is starting."
Write-Host "API: http://127.0.0.1:$ApiPort"
Write-Host "Web: http://localhost:$WebPort"
Write-Host "Press Ctrl+C to stop both processes."

try {
    while (-not $apiProcess.HasExited -and -not $webProcess.HasExited) {
        Start-Sleep -Seconds 1
    }
}
finally {
    if (-not $apiProcess.HasExited) {
        Stop-Process -Id $apiProcess.Id -Force
    }
    if (-not $webProcess.HasExited) {
        Stop-Process -Id $webProcess.Id -Force
    }
}

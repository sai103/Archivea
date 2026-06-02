param(
    [int]$ApiPort = 8000,
    [int]$WebPort = 5173,
    [string]$ApiLogConfig = "config\logging.dev.json"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$backendDir = Join-Path $repoRoot "backend"
$clientWebDir = Join-Path $repoRoot "client_web"
$venvDir = Join-Path $backendDir ".venv"
$pythonExe = Join-Path $venvDir "Scripts\python.exe"
$apiLogConfigPath = Join-Path $backendDir $ApiLogConfig

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

    $lockFile     = Join-Path $clientWebDir "package-lock.json"
    $installedMark = Join-Path $clientWebDir "node_modules\.package-lock.json"

    # node_modulesが存在しpackage-lock.jsonより新しければ再インストールをスキップする。
    if ((Test-Path $installedMark) -and (Test-Path $lockFile)) {
        $lockTime      = (Get-Item $lockFile).LastWriteTimeUtc
        $installedTime = (Get-Item $installedMark).LastWriteTimeUtc
        if ($installedTime -ge $lockTime) {
            Write-Host "Web dependencies are up to date, skipping npm ci."
            return
        }
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

function Ensure-LogDirectories {
    param([string]$LogConfigPath)

    if (-not (Test-Path $LogConfigPath)) {
        throw "API log config was not found: $LogConfigPath"
    }

    $logConfig = Get-Content $LogConfigPath -Raw | ConvertFrom-Json
    $handlerProperties = $logConfig.handlers.PSObject.Properties

    foreach ($handlerProperty in $handlerProperties) {
        $handler = $handlerProperty.Value
        if ($null -eq $handler.filename) {
            continue
        }

        $logFilePath = $handler.filename
        if (-not [System.IO.Path]::IsPathRooted($logFilePath)) {
            $logFilePath = Join-Path $backendDir $logFilePath
        }

        $logDirectory = Split-Path $logFilePath -Parent
        if (-not (Test-Path $logDirectory)) {
            New-Item -ItemType Directory -Path $logDirectory | Out-Null
        }
    }
}

Ensure-Backend
Ensure-ClientWeb
Ensure-LogDirectories -LogConfigPath $apiLogConfigPath

Write-Host "Starting Archivea API on http://127.0.0.1:$ApiPort"
Write-Host "API log config: $apiLogConfigPath"
$apiProcess = Start-Process `
    -FilePath $pythonExe `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "$ApiPort", "--log-config", "$apiLogConfigPath") `
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

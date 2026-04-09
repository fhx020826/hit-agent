$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir 'backend'

if (-not (Test-Path $backendDir)) {
  throw "Backend directory not found: $backendDir"
}

Set-Location $backendDir

if (-not (Test-Path '.venv\Scripts\python.exe')) {
  python -m venv .venv
}

& '.venv\Scripts\python.exe' -m uvicorn app.main:app --host 0.0.0.0 --port 8000

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $root 'frontend')

$nodeDir = Join-Path $root 'node-v24.14.1-win-x64'
if (-not (Test-Path $nodeDir)) {
  throw 'Portable Node.js not found. Please extract node-v24.14.1-win-x64.zip first.'
}

$env:PATH = "$nodeDir;" + $env:PATH
if (-not (Test-Path 'node_modules\next')) {
  throw 'Frontend dependencies are missing. Run install-frontend.ps1 first.'
}

& (Join-Path $nodeDir 'npm.cmd') run dev -- --hostname 0.0.0.0

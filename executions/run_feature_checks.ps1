param(
  [switch]$SkipLint,
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot

try {
  if (-not (Test-Path "package.json")) {
    throw "package.json not found in $projectRoot"
  }

  if (-not $SkipLint) {
    Write-Host "[checks] Running lint..." -ForegroundColor Cyan
    npm run lint
    if ($LASTEXITCODE -ne 0) {
      throw "Lint failed."
    }
  }

  if (-not $SkipBuild) {
    Write-Host "[checks] Running build..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "Build failed."
    }
  }

  Write-Host "[checks] All requested checks passed." -ForegroundColor Green
}
finally {
  Pop-Location
}

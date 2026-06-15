$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$Out = Join-Path $Root "infra\terraform\build\integrity-gate.zip"
$BuildDir = Join-Path $Root "infra\terraform\build"
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
$WorkDir = Join-Path $env:TEMP "cognimesh-ig-$(Get-Random)"
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

try {
  Copy-Item -Recurse (Join-Path $Root "services\lambda\integrity-gate\*") $WorkDir
  Copy-Item -Recurse (Join-Path $Root "lib") (Join-Path $WorkDir "lib")
  Copy-Item -Recurse (Join-Path $Root "rules") (Join-Path $WorkDir "rules")
  Copy-Item -Recurse (Join-Path $Root "schemas") (Join-Path $WorkDir "schemas")
  New-Item -ItemType Directory -Force -Path (Join-Path $WorkDir "services\pipeline-engine") | Out-Null
  Copy-Item (Join-Path $Root "services\pipeline-engine\compile.js") (Join-Path $WorkDir "services\pipeline-engine\")
  Push-Location $WorkDir
  npm install --omit=dev 2>$null
  if (Test-Path $Out) { Remove-Item $Out }
  Compress-Archive -Path "$WorkDir\*" -DestinationPath $Out
  Write-Host "Built $Out"
} finally {
  Pop-Location -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force $WorkDir -ErrorAction SilentlyContinue
}

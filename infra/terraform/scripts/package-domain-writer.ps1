$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$Out = Join-Path $Root "infra\terraform\build\domain-writer.zip"
$BuildDir = Join-Path $Root "infra\terraform\build"
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
$WorkDir = Join-Path $env:TEMP "cognimesh-dw-$(Get-Random)"
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

try {
  Copy-Item -Recurse (Join-Path $Root "services\lambda\domain-writer\*") $WorkDir
  New-Item -ItemType Directory -Force -Path (Join-Path $WorkDir "services\pvdm-runtime") | Out-Null
  Copy-Item (Join-Path $Root "services\pvdm-runtime\index.js") (Join-Path $WorkDir "services\pvdm-runtime\")
  Copy-Item -Recurse (Join-Path $Root "lib") (Join-Path $WorkDir "lib")
  Copy-Item -Recurse (Join-Path $Root "rules") (Join-Path $WorkDir "rules")
  Copy-Item -Recurse (Join-Path $Root "schemas") (Join-Path $WorkDir "schemas")
  Push-Location $WorkDir
  if (Test-Path $Out) { Remove-Item $Out }
  Compress-Archive -Path "$WorkDir\*" -DestinationPath $Out
  Write-Host "Built $Out"
} finally {
  Pop-Location -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force $WorkDir -ErrorAction SilentlyContinue
}

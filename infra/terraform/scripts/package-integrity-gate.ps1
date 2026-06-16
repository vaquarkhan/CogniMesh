$ErrorActionPreference = "Stop"
node (Join-Path $PSScriptRoot "package-lambda.js") integrity-gate @args

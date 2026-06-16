$ErrorActionPreference = "Stop"
node (Join-Path $PSScriptRoot "package-lambda.js") domain-writer @args

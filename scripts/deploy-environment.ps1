<# 
.SYNOPSIS
  CogniMesh One-Click Environment Deploy (PowerShell — Windows native)

.DESCRIPTION
  Deploys the full CogniMesh stack from git:
    1. Terraform (VPC, ECS, Lambda, S3, Cognito, CloudFront)
    2. ECR repo + API Docker image build + push
    3. ECS service update
    4. Portal build + S3 sync + CloudFront invalidation

.PARAMETER Region
  AWS region (default: value from terraform.tfvars)

.PARAMETER Prefix
  Resource name prefix (default: cognimesh)

.PARAMETER SkipTerraform
  Skip terraform apply

.PARAMETER SkipApi
  Skip API image build+push+deploy

.PARAMETER SkipPortal
  Skip portal build+deploy

.PARAMETER StudioUrl
  AgentCore Studio URL for embedding (optional)

.EXAMPLE
  .\scripts\deploy-environment.ps1
  .\scripts\deploy-environment.ps1 -Region eu-west-1 -Prefix cognimesh-eu
  .\scripts\deploy-environment.ps1 -SkipTerraform -StudioUrl "https://studio.example.com"
#>

param(
    [string]$Region = "us-east-1",
    [string]$Prefix = "cognimesh",
    [string]$EnvDir = "prod",
    [switch]$SkipTerraform,
    [switch]$SkipApi,
    [switch]$SkipPortal,
    [string]$StudioUrl = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $RepoRoot) { $RepoRoot = (Get-Location).Path }
$TfDir = Join-Path $RepoRoot "infra/terraform/environments/$EnvDir"

$AccountId = (aws sts get-caller-identity --query Account --output text --region $Region).Trim()
$EcrRepo = "$Prefix-api"
$EcrUri = "$AccountId.dkr.ecr.$Region.amazonaws.com/$EcrRepo"

Write-Host ""
Write-Host "=== CogniMesh Deploy ===" -ForegroundColor Cyan
Write-Host "  Region:  $Region"
Write-Host "  Prefix:  $Prefix"
Write-Host "  Account: $AccountId"
Write-Host "  TF dir:  $TfDir"
Write-Host ""

# ─── STEP 1: Terraform ───
if (-not $SkipTerraform) {
    Write-Host "Step 1: Terraform apply..." -ForegroundColor Yellow
    Push-Location $TfDir
    terraform init -input=false
    terraform apply -auto-approve -input=false
    Pop-Location
    Write-Host "Done: Terraform" -ForegroundColor Green
} else {
    Write-Host "Skipping Terraform" -ForegroundColor DarkGray
}

# ─── STEP 2: API Image ───
if (-not $SkipApi) {
    Write-Host ""
    Write-Host "Step 2: Build + push API image..." -ForegroundColor Yellow

    # Create ECR if needed
    $existing = aws ecr describe-repositories --repository-names $EcrRepo --region $Region 2>&1
    if ($LASTEXITCODE -ne 0) {
        aws ecr create-repository --repository-name $EcrRepo --region $Region | Out-Null
    }

    # Login
    $pass = aws ecr get-login-password --region $Region
    $pass | docker login --username AWS --password-stdin $EcrUri

    # Build + push
    docker build -f docker/api.Dockerfile -t "${EcrRepo}:latest" $RepoRoot
    docker tag "${EcrRepo}:latest" "${EcrUri}:latest"
    docker push "${EcrUri}:latest"
    Write-Host "Image pushed: ${EcrUri}:latest" -ForegroundColor Green

    # Update ECS
    aws ecs update-service --cluster "$Prefix-api" --service "$Prefix-api" --force-new-deployment --region $Region | Out-Null
    Write-Host "ECS service updated (rolling deploy)" -ForegroundColor Green
} else {
    Write-Host "Skipping API build" -ForegroundColor DarkGray
}

# ─── STEP 3: Portal ───
if (-not $SkipPortal) {
    Write-Host ""
    Write-Host "Step 3: Build + deploy portal..." -ForegroundColor Yellow
    Push-Location (Join-Path $RepoRoot "portal")

    $env:VITE_AGENTCORE_STUDIO_URL = $StudioUrl
    npm install --prefer-offline
    npm run build

    Pop-Location

    $PortalBucket = "$Prefix-portal-$AccountId"
    aws s3 sync (Join-Path $RepoRoot "portal/dist") "s3://$PortalBucket/" --delete --region $Region

    # Invalidate CloudFront
    $distId = aws cloudfront list-distributions --query "DistributionList.Items[?contains(Origins.Items[].DomainName, '$PortalBucket')].Id | [0]" --output text 2>$null
    if ($distId -and $distId -ne "None") {
        aws cloudfront create-invalidation --distribution-id $distId --paths "/*" | Out-Null
        Write-Host "Portal deployed + CloudFront invalidated ($distId)" -ForegroundColor Green
    } else {
        Write-Host "Portal deployed to S3 (no CloudFront dist found)" -ForegroundColor Green
    }
} else {
    Write-Host "Skipping portal" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== Deploy complete! ===" -ForegroundColor Cyan

# Set Cognito permanent password
Write-Host ""
Write-Host "Setting Cognito admin password..." -ForegroundColor Yellow
$poolId = (aws cognito-idp list-user-pools --max-results 10 --region $Region --query "UserPools[?Name=='$Prefix-user-pool'].Id | [0]" --output text 2>$null)
if ($poolId -and $poolId -ne "None") {
    $adminUser = (aws cognito-idp list-users --user-pool-id $poolId --region $Region --query "Users[0].Username" --output text 2>$null)
    if ($adminUser -and $adminUser -ne "None") {
        aws cognito-idp admin-set-user-password --user-pool-id $poolId --username $adminUser --password "CogniMesh2026!" --permanent --region $Region 2>$null
        Write-Host "Cognito password set for $adminUser (password: CogniMesh2026!)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "  Next: wait ~2min for ECS, then open the portal CloudFront URL."
if (-not $StudioUrl) {
    Write-Host "  Studio: not configured. Run deploy-studio.sh or pass -StudioUrl."
}

# OrangeCloud DocOps — put Cloudflare Access secrets
#
# Prerequisites:
# 1. Zero Trust → Access → Applications for:
#    - https://docops-stg.orangecloud.vn
#    - https://docops.orangecloud.vn
# 2. Copy Application Audience (AUD) from each app (or shared AUD).
# 3. Team domain is the subdomain before .cloudflareaccess.com
#    e.g. team "orangecloud" → orangecloud.cloudflareaccess.com
#
# Usage (PowerShell):
#   $env:CLOUDFLARE_ACCOUNT_ID = "4c15704ef706b9c8954cd6f9feb678d8"
#   $env:CF_ACCESS_TEAM_DOMAIN = "your-team"
#   $env:CF_ACCESS_AUD_STAGING = "<staging-aud-uuid>"
#   $env:CF_ACCESS_AUD_PRODUCTION = "<production-aud-uuid>"
#   pwsh -File scripts/put-access-secrets.ps1

$ErrorActionPreference = "Stop"

if (-not $env:CLOUDFLARE_ACCOUNT_ID) {
  Write-Error "Set CLOUDFLARE_ACCOUNT_ID (Cloudspace: 4c15704ef706b9c8954cd6f9feb678d8)"
}

if (-not $env:CF_ACCESS_TEAM_DOMAIN) {
  Write-Error "Set CF_ACCESS_TEAM_DOMAIN (Zero Trust team name, no .cloudflareaccess.com suffix)"
}

if (-not $env:CF_ACCESS_AUD_STAGING) {
  Write-Error "Set CF_ACCESS_AUD_STAGING to the Access Application Audience for staging"
}

if (-not $env:CF_ACCESS_AUD_PRODUCTION) {
  Write-Error "Set CF_ACCESS_AUD_PRODUCTION to the Access Application Audience for production"
}

Write-Host "Putting CF_ACCESS_TEAM_DOMAIN for staging + production..."
$env:CF_ACCESS_TEAM_DOMAIN | npx wrangler secret put CF_ACCESS_TEAM_DOMAIN --env staging
$env:CF_ACCESS_TEAM_DOMAIN | npx wrangler secret put CF_ACCESS_TEAM_DOMAIN --env production

Write-Host "Putting CF_ACCESS_AUD for staging..."
$env:CF_ACCESS_AUD_STAGING | npx wrangler secret put CF_ACCESS_AUD --env staging

Write-Host "Putting CF_ACCESS_AUD for production..."
$env:CF_ACCESS_AUD_PRODUCTION | npx wrangler secret put CF_ACCESS_AUD --env production

Write-Host "Done. Verify via /api/health readiness.accessConfigured after deploy."

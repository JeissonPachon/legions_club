Param(
  [string]$CaPath = './certs/ca.pem'
)

if (-Not (Test-Path $CaPath)) {
  Write-Host "CA file not found at $CaPath" -ForegroundColor Red
  Write-Host "Use scripts/extract-ca.sh <host> to create it, or place the PEM in certs/ca.pem." -ForegroundColor Yellow
  exit 1
}

$full = Resolve-Path $CaPath
Write-Host "Using CA file: $full" -ForegroundColor Green
$env:NODE_EXTRA_CA_CERTS = $full
npm run dev

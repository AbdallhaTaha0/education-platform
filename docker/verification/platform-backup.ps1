param(
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9-]+$')][string]$Project,
  [Parameter(Mandatory)][string]$Container,
  [Parameter(Mandatory)][ValidatePattern('^[a-zA-Z0-9_]+$')][string]$Database,
  [ValidatePattern('^[a-zA-Z0-9_]+$')][string]$DatabaseUser = 'postgres',
  [Parameter(Mandatory)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
$owner = docker inspect $Container --format '{{index .Config.Labels "com.docker.compose.project"}}'
if ($LASTEXITCODE -ne 0 -or $owner -ne $Project) { throw 'Database container ownership mismatch.' }
$target = [System.IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $target) { throw 'Refusing to overwrite an existing backup.' }
if (!(Test-Path -LiteralPath (Split-Path $target))) { throw 'Create the backup destination directory first.' }
$temp = '/tmp/platform-backup-' + [guid]::NewGuid().ToString('N') + '.dump'
try {
  docker exec --user postgres $Container pg_dump --username=$DatabaseUser --dbname=$Database --format=custom --file=$temp
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }
  docker exec --user postgres $Container pg_restore --list $temp | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Backup archive validation failed.' }
  docker cp "${Container}:$temp" $target
  if ($LASTEXITCODE -ne 0) { throw 'Backup export failed.' }
  $manifest = [ordered]@{ database=$Database; project=$Project; createdUtc=[DateTime]::UtcNow.ToString('o'); sha256=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash; format='pg_dump custom'; scope='Platform PostgreSQL including private recharge proofs; excludes Redis, external DRM and media' }
  $manifest | ConvertTo-Json | Set-Content -LiteralPath ($target + '.manifest.json') -Encoding utf8
  Write-Output 'BACKUP_OK: validated custom archive and SHA256 manifest written.'
} finally {
  docker exec --user postgres $Container rm -f $temp | Out-Null
}

param(
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9-]+$')][string]$Project,
  [Parameter(Mandatory)][string]$Container,
  [Parameter(Mandatory)][string]$BackupPath,
  [Parameter(Mandatory)][ValidatePattern('^m7_restore_[a-z0-9_]+$')][string]$TargetDatabase,
  [ValidatePattern('^[a-zA-Z0-9_]+$')][string]$DatabaseUser = 'postgres'
)
# No --clean, no dropdb: only creates a new prefixed drill database.
$ErrorActionPreference = 'Stop'
$owner = docker inspect $Container --format '{{index .Config.Labels "com.docker.compose.project"}}'
if ($LASTEXITCODE -ne 0 -or $owner -ne $Project) { throw 'Database container ownership mismatch.' }
$backup = [System.IO.Path]::GetFullPath($BackupPath)
$manifest = Get-Content -LiteralPath ($backup + '.manifest.json') -Raw | ConvertFrom-Json
if ((Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash -ne $manifest.sha256) { throw 'Backup checksum mismatch.' }
$temp = '/tmp/platform-restore-' + [guid]::NewGuid().ToString('N') + '.dump'
try {
  docker exec --user postgres $Container createdb --username=$DatabaseUser --template=template0 $TargetDatabase
  if ($LASTEXITCODE -ne 0) { throw 'Target must be a new database; existing databases are never overwritten.' }
  docker cp $backup "${Container}:$temp"
  if ($LASTEXITCODE -ne 0) { throw 'Backup transfer failed.' }
  docker exec --user root $Container chown postgres:postgres $temp
  if ($LASTEXITCODE -ne 0) { throw 'Backup ownership setup failed.' }
  docker exec --user postgres $Container pg_restore --username=$DatabaseUser --dbname=$TargetDatabase --exit-on-error --single-transaction --no-owner --no-privileges $temp
  if ($LASTEXITCODE -ne 0) { throw 'Restore failed; isolate the drill database for investigation.' }
  docker exec --user postgres $Container psql --username=$DatabaseUser --dbname=$TargetDatabase --set=ON_ERROR_STOP=1 --command='SELECT count(*) AS applied_migrations FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;'
  if ($LASTEXITCODE -ne 0) { throw 'Restored migration metadata query failed.' }
  Write-Output 'RESTORE_OK: archive restored transactionally to a new drill database. Verify business invariants before promotion.'
} finally {
  docker exec --user postgres $Container rm -f $temp | Out-Null
}

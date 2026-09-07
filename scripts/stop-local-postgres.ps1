$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $repoRoot '.pgdata'
$pgCtl = 'C:\Program Files\PostgreSQL\15\bin\pg_ctl.exe'

if ((Test-Path $pgCtl) -and (Test-Path (Join-Path $dataDir 'PG_VERSION'))) {
  & $pgCtl -D $dataDir stop -m fast 2>$null | Out-Null
}

exit 0

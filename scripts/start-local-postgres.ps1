$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $repoRoot '.pgdata'
$logDir = Join-Path $repoRoot '.pglog'
$logFile = Join-Path $logDir 'postgres.log'
$pgCtl = 'C:\Program Files\PostgreSQL\15\bin\pg_ctl.exe'
$initDb = 'C:\Program Files\PostgreSQL\15\bin\initdb.exe'
$createDb = 'C:\Program Files\PostgreSQL\15\bin\createdb.exe'
$psql = 'C:\Program Files\PostgreSQL\15\bin\psql.exe'
$port = 5433
$bindAddress = '127.0.0.1'
$dbName = 'protein_compare'

if (!(Test-Path $pgCtl)) {
  throw "pg_ctl.exe not found: $pgCtl"
}

if (!(Test-Path $psql)) {
  throw "psql.exe not found: $psql"
}

function Test-PostgresReady {
  try {
    $result = (& $psql -h $bindAddress -p $port -U postgres -d postgres -tAc 'SELECT 1' 2>$null).Trim()
    return $result -eq '1'
  } catch {
    return $false
  }
}

if (!(Test-Path $dataDir)) {
  New-Item -ItemType Directory -Path $dataDir | Out-Null
}

if (!(Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

if (!(Test-Path (Join-Path $dataDir 'PG_VERSION'))) {
  & $initDb -D $dataDir -U postgres --auth-local=trust --auth-host=trust --encoding=UTF8 | Out-Null
}

if (-not (Test-PostgresReady)) {
  & $pgCtl -D $dataDir -l $logFile -w start -o "-p $port -h $bindAddress" | Out-Null
}

if (-not (Test-PostgresReady)) {
  throw 'Local PostgreSQL did not become ready.'
}

$dbExists = (& $psql -h $bindAddress -p $port -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$dbName'").Trim()
if ($dbExists -ne '1') {
  & $createDb -p $port -h $bindAddress -U postgres $dbName | Out-Null
}

exit 0

param(
  [string]$TaskName = "ProteinPriceCompare-RakutenDailySync",
  [string]$Time = "06:00",
  [switch]$RunNow
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$escapedRepoRoot = $repoRoot.Replace('"', '""')
$syncCommand = "npm --prefix backend run sync -- --provider rakutenListed"

$taskCommand = "cd /d `"$escapedRepoRoot`" && $syncCommand"
$taskRunner = "cmd.exe /c $taskCommand"

schtasks /Create /F /SC DAILY /TN $TaskName /ST $Time /TR $taskRunner | Out-Null

Write-Output "Registered task '$TaskName' at $Time"
Write-Output "Command: $syncCommand"

if ($RunNow) {
  schtasks /Run /TN $TaskName | Out-Null
  Write-Output "Started task '$TaskName'"
}

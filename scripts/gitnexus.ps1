[CmdletBinding()]
param(
    [ValidateSet('analyze', 'status', 'mcp')]
    [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runner = Get-Command gitnexus -ErrorAction Stop
$gitRoot = & git -C $projectRoot rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath($gitRoot) -ne [IO.Path]::GetFullPath($projectRoot)) {
    throw 'The launcher must belong to this repository root.'
}
$remote = & git -C $projectRoot remote get-url origin
if ($LASTEXITCODE -ne 0 -or $remote -notmatch '^(https://github\.com/ren-sidequest/hackathon-1(?:\.git)?|git@github\.com:ren-sidequest/hackathon-1(?:\.git)?)$') {
    throw 'Expected origin: ren-sidequest/hackathon-1. Refusing another repository.'
}

$localEnvironment = @{
    GITNEXUS_HOME = Join-Path $projectRoot '.gitnexus/home'
    GITNEXUS_STORAGE_PATH = Join-Path $projectRoot '.gitnexus/index'
    GITNEXUS_STORAGE_ROOT = $null
}
$previousEnvironment = @{}
foreach ($key in $localEnvironment.Keys) {
    $previousEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
}

Push-Location -LiteralPath $projectRoot
try {
    foreach ($key in $localEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($key, $localEnvironment[$key], 'Process')
    }
    if ($Action -eq 'analyze') {
        & $runner analyze $projectRoot --index-only --name hackathon-1
    } else {
        & $runner $Action
    }
    $resultCode = $LASTEXITCODE
} finally {
    foreach ($key in $previousEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($key, $previousEnvironment[$key], 'Process')
    }
    Pop-Location
}
exit $resultCode

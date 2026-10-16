param(
    [switch]$RefreshPdg,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$AppArguments
)

$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot
$settings = @{}
Get-Content (Join-Path $rootDir "tools\pdg-release.env") | ForEach-Object {
    if ($_ -match '^([A-Z0-9_]+)=(.+)$') { $settings[$matches[1]] = $matches[2] }
}

$appScript = Join-Path $rootDir "main.js"
if ($AppArguments.Count -gt 0 -and $AppArguments[0] -eq "--") {
    $AppArguments = @($AppArguments | Select-Object -Skip 1)
} elseif ($AppArguments.Count -gt 0 -and $AppArguments[0].EndsWith(".js")) {
    $candidate = $AppArguments[0]
    if (-not [IO.Path]::IsPathRooted($candidate)) { $candidate = Join-Path $rootDir $candidate }
    $appScript = $candidate
    $AppArguments = @($AppArguments | Select-Object -Skip 1)
}

$pdgSource = if ($env:PDG_SOURCE) { $env:PDG_SOURCE } else { "release" }
if ($pdgSource -cnotin @("release", "devel")) { throw "PDG_SOURCE must be release or devel" }
if ($pdgSource -eq "devel" -and $RefreshPdg) { throw "-RefreshPdg requires PDG_SOURCE=release" }

if ($env:PDG_EXECUTABLE) {
    & $env:PDG_EXECUTABLE $appScript @AppArguments
    exit $LASTEXITCODE
}

if ($pdgSource -eq "devel") {
    $develDir = if ($env:PDG_DEVEL_DIR) { $env:PDG_DEVEL_DIR } else { Join-Path $rootDir "..\pdg-devel" }
    $localPdg = Join-Path $develDir "pdg.exe"
    if (-not (Test-Path $localPdg -PathType Leaf)) {
        throw "Development PDG executable not found: $localPdg. Build pdg-devel with make.ps1 pdg or set PDG_EXECUTABLE."
    }
    & $localPdg $appScript @AppArguments
    exit $LASTEXITCODE
}

$cacheRoot = if ($env:PDG_CACHE_DIR) { $env:PDG_CACHE_DIR } else { Join-Path $rootDir ".pdg" }
$installDir = Join-Path $cacheRoot "$($settings.PDG_VERSION)\windows-x64"
$pdgExe = Join-Path $installDir "pdg.exe"
$assetUrl = "$($settings.PDG_REPOSITORY)/releases/download/$($settings.PDG_TAG)/$($settings.PDG_WINDOWS_X64_ASSET)"

if ($RefreshPdg -and (Test-Path $installDir)) { Remove-Item $installDir -Recurse -Force }
if (-not (Test-Path $pdgExe)) {
    New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null
    $downloadFile = Join-Path $cacheRoot "pdg-download-$([guid]::NewGuid()).zip"
    $extractDir = Join-Path $cacheRoot "pdg-extract-$([guid]::NewGuid())"
    try {
        Write-Host "Downloading pinned PDG $($settings.PDG_TAG)..."
        Invoke-WebRequest -Uri $assetUrl -OutFile $downloadFile
        $actualSha = (Get-FileHash -Algorithm SHA256 $downloadFile).Hash.ToLowerInvariant()
        if ($actualSha -ne $settings.PDG_WINDOWS_X64_SHA256) {
            throw "PDG checksum mismatch: expected $($settings.PDG_WINDOWS_X64_SHA256), got $actualSha"
        }
        Expand-Archive -Path $downloadFile -DestinationPath $extractDir
        New-Item -ItemType Directory -Path (Split-Path $installDir) -Force | Out-Null
        Remove-Item $installDir -Recurse -Force -ErrorAction SilentlyContinue
        Move-Item $extractDir $installDir
    } finally {
        Remove-Item $downloadFile -Force -ErrorAction SilentlyContinue
        Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

& $pdgExe $appScript @AppArguments
exit $LASTEXITCODE

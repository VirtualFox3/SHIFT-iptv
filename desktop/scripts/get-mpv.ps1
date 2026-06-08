# Downloads a Windows mpv build and extracts mpv.exe into desktop/bin so it can
# be bundled into the installer. Optional — if you skip this, the app falls back
# to an mpv on your PATH (install with: winget install shinchiro.mpv).

$ErrorActionPreference = 'Stop'
$binDir = Join-Path $PSScriptRoot '..\bin'
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

if (Test-Path (Join-Path $binDir 'mpv.exe')) {
  Write-Host 'mpv.exe already present in bin/ — nothing to do.'
  exit 0
}

# zhongfly publishes ready-to-use Windows mpv zips (no 7-Zip needed).
Write-Host 'Fetching latest mpv Windows build info...'
$rel = Invoke-RestMethod 'https://api.github.com/repos/zhongfly/mpv-winbuild/releases/latest' -Headers @{ 'User-Agent' = 'shift-desktop' }
$asset = $rel.assets | Where-Object { $_.name -match 'mpv-x86_64-.*\.zip$' -and $_.name -notmatch 'v3' } | Select-Object -First 1
if (-not $asset) { $asset = $rel.assets | Where-Object { $_.name -match '\.zip$' } | Select-Object -First 1 }
if (-not $asset) { throw 'Could not find an mpv zip asset in the latest release.' }

$zip = Join-Path $env:TEMP $asset.name
Write-Host "Downloading $($asset.name)..."
Invoke-WebRequest $asset.browser_download_url -OutFile $zip -Headers @{ 'User-Agent' = 'shift-desktop' }

Write-Host 'Extracting mpv.exe...'
$tmp = Join-Path $env:TEMP 'mpv-extract'
Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
Expand-Archive -Path $zip -DestinationPath $tmp -Force
$exe = Get-ChildItem -Path $tmp -Recurse -Filter 'mpv.exe' | Select-Object -First 1
if (-not $exe) { throw 'mpv.exe not found in the downloaded archive.' }
Copy-Item $exe.FullName (Join-Path $binDir 'mpv.exe') -Force

Write-Host "Done — mpv.exe placed in $binDir"

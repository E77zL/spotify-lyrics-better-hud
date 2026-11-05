param([string]$CacheDir = (Join-Path $PSScriptRoot '.cache'))
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$build = Join-Path $root '.build'
$dist = Join-Path $root 'dist'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw 'Windows x64 with .NET Framework 4.x compiler is required.' }
if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22 or later before building.' }
$nodeMajor = [int]((& node -p 'process.versions.node.split(".")[0]') | Select-Object -Last 1)
if ($nodeMajor -lt 22) { throw 'Node.js 22 or later is required.' }
& node (Join-Path $root 'tests/version.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Release version consistency check failed.' }
$CacheDir = [IO.Path]::GetFullPath($CacheDir)
& node (Join-Path $root 'scripts/Download.cjs') $CacheDir
if ($LASTEXITCODE -ne 0) { throw 'Dependency preparation failed.' }
if (Test-Path -LiteralPath $build) {
    if ([IO.Path]::GetFullPath($build) -ne [IO.Path]::GetFullPath((Join-Path $root '.build'))) { throw 'Unsafe build cleanup path.' }
    Remove-Item -LiteralPath $build -Recurse -Force
}
$payload = Join-Path $build 'payload'
$hud = Join-Path $build 'HUD'
New-Item -ItemType Directory -Path $payload,$hud,$dist,(Join-Path $build '7zip'),(Join-Path $build 'ws') -Force | Out-Null
& tar -xf (Join-Path $CacheDir '7zip-bin-5.2.0.tgz') -C (Join-Path $build '7zip')
if ($LASTEXITCODE -ne 0) { throw '7-Zip dependency extraction failed.' }
& tar -xf (Join-Path $CacheDir 'ws-8.22.0.tgz') -C (Join-Path $build 'ws')
if ($LASTEXITCODE -ne 0) { throw 'ws dependency extraction failed.' }
$archiver = Join-Path $build '7zip/package/win/x64/7za.exe'
& $archiver x '-y' '-bso0' ('-o' + $hud) (Join-Path $CacheDir 'SpotifyLyricsHUD-Setup-5.1.0.exe')
if ($LASTEXITCODE -ne 0) { throw 'Upstream runtime extraction failed.' }
& node (Join-Path $root 'scripts/Prepare-App.cjs')
if ($LASTEXITCODE -ne 0) { throw 'App preparation failed.' }
& node (Join-Path $root 'scripts/Test.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Regression checks failed.' }
$manifest = '/win32manifest:' + (Join-Path $root 'installer/installer.manifest')
& (Join-Path $root 'scripts/Build-Native.ps1') -OutputDir $payload
if ($LASTEXITCODE -ne 0) { throw 'Spotify process bridge compilation failed.' }
Copy-Item -LiteralPath (Join-Path $payload 'FullscreenObserver.exe') -Destination (Join-Path $hud 'resources/app/src/FullscreenObserver.exe')
& (Join-Path $root 'scripts/Build-Native.ps1') -OutputDir (Join-Path $build 'native-qa') -TestMode
if ($LASTEXITCODE -ne 0) { throw 'Native test fixture compilation failed.' }
& node (Join-Path $root 'tests/native.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Native lifecycle checks failed.' }
& node (Join-Path $root 'tests/fullscreen-native.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Fullscreen observer lifecycle checks failed.' }
& (Join-Path $root 'tests/bridge-install.ps1') -Payload (Join-Path $payload 'version.dll')
Push-Location $hud
try {
    & $archiver a -tzip -mx=5 -bso0 (Join-Path $payload 'SpotifyLyricsHUD-1.2.2.zip') '.\*'
    if ($LASTEXITCODE -ne 0) { throw 'HUD packaging failed.' }
} finally { Pop-Location }
& node (Join-Path $root 'scripts/Archive-Source.cjs') (Join-Path $payload 'HUD-INTEGRATION-SOURCE.zip') $archiver
if ($LASTEXITCODE -ne 0) { throw 'Source packaging failed.' }
foreach ($name in @('ConsoleActions.ps1','Bridge.ps1','spicetify-release.json')) { Copy-Item -LiteralPath (Join-Path $root ('installer/' + $name)) -Destination $payload }
Copy-Item -LiteralPath (Join-Path $root 'extension/spotify-lyrics-hud.js') -Destination $payload
foreach ($name in @('HUD-LICENSE.txt','SPICETIFY-LICENSE')) { Copy-Item -LiteralPath (Join-Path $root ('licenses/' + $name)) -Destination $payload }
foreach ($name in @('README.md','NOTICE.txt','LICENSE')) { Copy-Item -LiteralPath (Join-Path $root $name) -Destination $payload }
foreach ($name in @('spicetify-windows-x64.zip','spicetify-source-v2.46.4.tar.gz')) { Copy-Item -LiteralPath (Join-Path $CacheDir $name) -Destination $payload }
foreach ($name in @('ConsoleActions.ps1','Bridge.ps1')) {
    $actions = Join-Path $payload $name
    [IO.File]::WriteAllText($actions,[IO.File]::ReadAllText($actions),(New-Object Text.UTF8Encoding($true)))
}
$files = @('ConsoleActions.ps1','Bridge.ps1','spotify-lyrics-hud.js','version.dll','SpotifyLyricsHUD-1.2.2.zip','HUD-LICENSE.txt','HUD-INTEGRATION-SOURCE.zip','spicetify-windows-x64.zip','spicetify-release.json','SPICETIFY-LICENSE','LICENSE','README.md','spicetify-source-v2.46.4.tar.gz','NOTICE.txt')
$hashes = foreach ($name in $files) { (Get-FileHash -LiteralPath (Join-Path $payload $name) -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + $name }
[IO.File]::WriteAllLines((Join-Path $payload 'manifest.sha256'),$hashes,(New-Object Text.UTF8Encoding($false)))
$output = Join-Path $dist 'Spotify-Lyrics-HUD-Setup-v1.2.2.exe'
$compilerArgs = @('/nologo','/target:exe','/platform:x64','/optimize+','/debug-','/codepage:65001','/utf8output',$manifest,('/out:' + $output))
foreach ($name in $files + @('manifest.sha256')) { $compilerArgs += '/resource:' + (Join-Path $payload $name) + ',payload.' + $name }
$compilerArgs += Join-Path $root 'installer/Installer.cs'
& $compiler @compilerArgs
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
& $output --self-test
if ($LASTEXITCODE -ne 0) { throw 'Installer self-test failed.' }
Copy-Item -LiteralPath (Join-Path $payload 'HUD-INTEGRATION-SOURCE.zip') -Destination (Join-Path $dist 'Spotify-Lyrics-HUD-Source-v1.2.2.zip') -Force
$releaseHashes = foreach ($name in @('Spotify-Lyrics-HUD-Setup-v1.2.2.exe','Spotify-Lyrics-HUD-Source-v1.2.2.zip')) { (Get-FileHash -LiteralPath (Join-Path $dist $name)).Hash.ToLowerInvariant() + '  ' + $name }
[IO.File]::WriteAllLines((Join-Path $dist 'SHA256SUMS.txt'),$releaseHashes,(New-Object Text.UTF8Encoding($false)))
Write-Host ('Build complete: ' + $dist) -ForegroundColor Green

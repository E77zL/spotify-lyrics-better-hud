param([string]$CacheDir = (Join-Path $PSScriptRoot '.cache'))
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$version=(Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$build=Join-Path $root '.build'
$dist=Join-Path $root 'dist'
$CacheDir=[IO.Path]::GetFullPath($CacheDir)
& node (Join-Path $root 'tests/version.cjs')
if($LASTEXITCODE -ne 0){throw 'Version mismatch.'}
& node (Join-Path $root 'scripts/Download.cjs') $CacheDir
if($LASTEXITCODE -ne 0){throw 'Dependency preparation failed.'}
$payload=Join-Path $build 'payload'
New-Item -ItemType Directory -Path $payload,$dist,(Join-Path $build '7zip'),(Join-Path $build 'ws') -Force | Out-Null
& tar -xf (Join-Path $CacheDir '7zip-bin-5.2.0.tgz') -C (Join-Path $build '7zip')
if($LASTEXITCODE -ne 0){throw '7-Zip extraction failed.'}
& tar -xf (Join-Path $CacheDir 'ws-8.22.0.tgz') -C (Join-Path $build 'ws')
if($LASTEXITCODE -ne 0){throw 'Test dependency extraction failed.'}
$env:NODE_PATH=Join-Path $build 'ws/package/..'
# npm archive is named package, while Node expects node_modules/ws.
$modules=Join-Path $build 'node_modules'
New-Item -ItemType Directory -Path $modules -Force | Out-Null
if(!(Test-Path (Join-Path $modules 'ws'))){Copy-Item -LiteralPath (Join-Path $build 'ws/package') -Destination (Join-Path $modules 'ws') -Recurse}
$env:NODE_PATH=$modules
$archiver=Join-Path $build '7zip/package/win/x64/7za.exe'
& node (Join-Path $root 'scripts/Bundle-Native.cjs')
if($LASTEXITCODE -ne 0){throw 'Provider bundle failed.'}
foreach($test in @('matching','providers','native-renderer')){
    & node (Join-Path $root ('tests/'+$test+'.cjs'))
    if($LASTEXITCODE -ne 0){throw ('Regression failed: '+$test)}
}
& (Join-Path $root 'scripts/Build-Native.ps1') -OutputDir (Join-Path $build 'native-qa') -TestMode
& node (Join-Path $root 'tests/native-hud.cjs')
if($LASTEXITCODE -ne 0){throw 'Native host tests failed.'}
& (Join-Path $root 'scripts/Build-Native.ps1') -OutputDir $payload
& (Join-Path $root 'tests/bridge-install.ps1') -Payload (Join-Path $payload 'version.dll')
& node (Join-Path $root 'scripts/Archive-Source.cjs') (Join-Path $payload 'HUD-INTEGRATION-SOURCE.zip') $archiver
if($LASTEXITCODE -ne 0){throw 'Source archive failed.'}
foreach($name in @('ConsoleActions.ps1','Bridge.ps1','spicetify-release.json')){Copy-Item -LiteralPath (Join-Path $root ('installer/'+$name)) -Destination $payload -Force}
foreach($name in @('HUD-LICENSE.txt','SPICETIFY-LICENSE','JSON-LICENSE.txt')){Copy-Item -LiteralPath (Join-Path $root ('licenses/'+$name)) -Destination $payload -Force}
foreach($name in @('README.md','NOTICE.txt','LICENSE')){Copy-Item -LiteralPath (Join-Path $root $name) -Destination $payload -Force}
foreach($name in @('spicetify-windows-x64.zip','spicetify-source-v2.46.4.tar.gz')){Copy-Item -LiteralPath (Join-Path $CacheDir $name) -Destination $payload -Force}
foreach($name in @('ConsoleActions.ps1','Bridge.ps1')){ $file=Join-Path $payload $name;[IO.File]::WriteAllText($file,[IO.File]::ReadAllText($file),(New-Object Text.UTF8Encoding($true))) }
$files=@('ConsoleActions.ps1','Bridge.ps1','spotify-lyrics-hud.js','version.dll','HUD-LICENSE.txt','JSON-LICENSE.txt','HUD-INTEGRATION-SOURCE.zip','spicetify-windows-x64.zip','spicetify-release.json','SPICETIFY-LICENSE','LICENSE','README.md','spicetify-source-v2.46.4.tar.gz','NOTICE.txt')
$hashes=foreach($name in $files){(Get-FileHash -LiteralPath (Join-Path $payload $name)).Hash.ToLowerInvariant()+'  '+$name}
[IO.File]::WriteAllLines((Join-Path $payload 'manifest.sha256'),$hashes,(New-Object Text.UTF8Encoding($false)))
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$output=Join-Path $dist "Spotify-Lyrics-HUD-Setup-v$version.exe"
$compilerArgs=@('/nologo','/target:exe','/platform:x64','/optimize+','/debug-','/codepage:65001','/utf8output',('/win32manifest:'+(Join-Path $root 'installer/installer.manifest')),('/out:'+$output))
foreach($name in $files+@('manifest.sha256')){$compilerArgs+='/resource:'+(Join-Path $payload $name)+',payload.'+$name}
$compilerArgs+=Join-Path $root 'installer/Installer.cs'
& $compiler @compilerArgs
if($LASTEXITCODE -ne 0){throw 'Installer compilation failed.'}
& $output --self-test
if($LASTEXITCODE -ne 0){throw 'Installer self-test failed.'}
Copy-Item -LiteralPath (Join-Path $payload 'HUD-INTEGRATION-SOURCE.zip') -Destination (Join-Path $dist "Spotify-Lyrics-HUD-Source-v$version.zip") -Force
$releaseHashes=foreach($name in @("Spotify-Lyrics-HUD-Setup-v$version.exe","Spotify-Lyrics-HUD-Source-v$version.zip")){(Get-FileHash -LiteralPath (Join-Path $dist $name)).Hash.ToLowerInvariant()+'  '+$name}
[IO.File]::WriteAllLines((Join-Path $dist 'SHA256SUMS.txt'),$releaseHashes,(New-Object Text.UTF8Encoding($false)))
Write-Host ("Native $version build complete: "+$dist) -ForegroundColor Green

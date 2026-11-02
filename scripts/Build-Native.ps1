param([string]$OutputDir = (Join-Path $PSScriptRoot '..\.build\payload'), [switch]$TestMode)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$OutputDir = [IO.Path]::GetFullPath($OutputDir)
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (!(Test-Path -LiteralPath $vswhere)) { throw 'Install Visual Studio Build Tools with Desktop development with C++ and the Windows SDK.' }
$vs = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (!$vs) { throw 'Visual C++ x64 compiler was not found.' }
$vcvars = Join-Path $vs 'VC\Auxiliary\Build\vcvars64.bat'
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
$mode = if ($TestMode) { '/DHUD_BRIDGE_TEST' } else { '' }
$batch = @"
@echo off
call "$vcvars" >nul
if errorlevel 1 exit /b 1
cd /d "$OutputDir"
rc /nologo /fo bridge.res "$root\native\bridge.rc"
if errorlevel 1 exit /b 1
cl /nologo /LD /MT /O2 /W4 /WX /wd4191 /EHsc /utf-8 /std:c++17 /DUNICODE /D_UNICODE $mode /Fo"bridge.obj" "$root\native\SpotifyLyricsBridge.cpp" bridge.res bcrypt.lib /link /DEF:"$root\native\version.def" /OUT:"version.dll" /INCREMENTAL:NO
if errorlevel 1 exit /b 1
"@
if ($TestMode) {
    $batch += @"

cl /nologo /MT /O2 /W4 /WX /wd4191 /EHsc /utf-8 /std:c++17 /DUNICODE /D_UNICODE /Fo"fixture.obj" "$root\tests\native-fixture.cpp" version.lib /link /OUT:"SpotifyBridgeTest.exe" /INCREMENTAL:NO
if errorlevel 1 exit /b 1
"@
}
$batch += "`r`nexit /b 0`r`n"
$batchFile = Join-Path $OutputDir 'compile-bridge.cmd'
[IO.File]::WriteAllText($batchFile,$batch,(New-Object Text.UTF8Encoding($false)))
& $env:ComSpec /d /c $batchFile
if ($LASTEXITCODE -ne 0) { throw 'Native Spotify process bridge compilation failed.' }

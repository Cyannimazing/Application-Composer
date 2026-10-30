param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$buildRoot = Join-Path $projectRoot '.local/desktop-build'
New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { $compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework/v4.0.30319/csc.exe' }
$node = (Get-Command node.exe -ErrorAction Stop).Source
$testExe = Join-Path $buildRoot 'LauncherTests.exe'
$testConfig = Join-Path $buildRoot 'TestBuildConfig.cs'
$fakeRoot = (Join-Path $buildRoot 'migration-fixture').Replace('"','""')
[System.IO.File]::WriteAllText($testConfig,('namespace ApplicationComposerDesktop { internal static class BuildConfig { internal const string SourceRoot = @"' + $fakeRoot + '"; internal const string BundleId = "test"; } }'))
& $compiler /nologo /target:exe /main:ApplicationComposerDesktop.LauncherTests "/out:$testExe" /r:System.dll /r:System.Core.dll /r:System.Web.Extensions.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll (Join-Path $PSScriptRoot 'Runtime.cs') (Join-Path $PSScriptRoot 'Bundle.cs') (Join-Path $PSScriptRoot 'LauncherTests.cs') $testConfig
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $testExe $node $projectRoot
exit $LASTEXITCODE

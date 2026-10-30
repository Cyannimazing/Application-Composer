param([switch]$InstallDesktop, [switch]$SkipAppBuild, [switch]$ReuseBundle)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$buildLock = New-Object System.Threading.Mutex($false,'Local\ApplicationComposer-Standalone')
$ownsLock = $false
try {
    try { $ownsLock = $buildLock.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $ownsLock = $true }
    if (-not $ownsLock) { throw 'Close the Application Composer desktop window before rebuilding or installing.' }
    $buildRoot = Join-Path $projectRoot '.local/desktop-build'
    New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    if ([int]((& $node --version).TrimStart('v').Split('.')[0]) -lt 22) { throw 'Node.js 22 or newer is required for building.' }
    if ((& $node -p 'process.arch') -ne 'x64') { throw 'This Windows desktop package requires an x64 Node.js build.' }
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
    if (-not (Test-Path -LiteralPath $compiler)) { throw 'Enable .NET Framework 4.8 in Windows, then retry.' }
    if (-not $SkipAppBuild) {
        Push-Location $projectRoot
        $previousBuildMode = $env:COMPOSER_DESKTOP_BUILD
        $nextEnvPath = Join-Path $projectRoot "next-env.d.ts"
        $nextEnvOriginal = if (Test-Path -LiteralPath $nextEnvPath) { [System.IO.File]::ReadAllBytes($nextEnvPath) } else { $null }
        try {
            $env:COREPACK_HOME = Join-Path $projectRoot '.local/corepack'; $env:COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'; $env:COMPOSER_DESKTOP_BUILD = '1'
            & pnpm.cmd build
            if ($LASTEXITCODE -ne 0) { throw 'Production build failed. Resolve the errors above, then retry.' }
        } finally { $env:COMPOSER_DESKTOP_BUILD = $previousBuildMode; if ($null -ne $nextEnvOriginal) { [System.IO.File]::WriteAllBytes($nextEnvPath,$nextEnvOriginal) }; Pop-Location }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.next-desktop/standalone/server.js'))) { throw 'Run pnpm desktop:build to create the standalone production server.' }
    $sdk = & (Join-Path $PSScriptRoot 'acquire-webview.ps1')
    $archive = Join-Path $buildRoot 'app-bundle.zip'
    if (-not $ReuseBundle) {
        & $node (Join-Path $PSScriptRoot 'pack-bundle.mjs')
        if ($LASTEXITCODE -ne 0) { throw 'Standalone bundle staging failed.' }
        & $node (Join-Path $PSScriptRoot 'check-staged.mjs')
        if ($LASTEXITCODE -ne 0) { throw 'The staged standalone app failed its startup check.' }
        $stage = Join-Path $buildRoot 'bundle-stage'
        Copy-Item -LiteralPath (Join-Path $sdk 'runtimes/win-x64/native/WebView2Loader.dll') -Destination $stage -Force
        New-Item -ItemType Directory -Path (Join-Path $stage 'licenses') -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $sdk 'LICENSE.txt') -Destination (Join-Path $stage 'licenses/WebView2.txt') -Force
        $nodeVersion = (& $node --version).Trim()
        $nodeLicense = Join-Path $buildRoot ('node-' + $nodeVersion + '-LICENSE.txt')
        if (-not (Test-Path -LiteralPath $nodeLicense)) { Invoke-WebRequest -Uri ('https://raw.githubusercontent.com/nodejs/node/' + $nodeVersion + '/LICENSE') -OutFile $nodeLicense -UseBasicParsing }
        Copy-Item -LiteralPath $nodeLicense -Destination (Join-Path $stage 'licenses/Node.txt') -Force
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archive = Join-Path $buildRoot 'app-bundle.zip'
        if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
        & "$env:WINDIR/System32/tar.exe" -a -c -f $archive -C $stage .
        if ($LASTEXITCODE -ne 0) { throw "Native Windows archive creation failed." }
    } elseif (-not (Test-Path -LiteralPath $archive)) { throw 'No existing bundle archive to reuse.' }
    $bundleId = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant().Substring(0,20)
    & (Join-Path $PSScriptRoot 'create-icon.ps1')
    $configPath = Join-Path $buildRoot 'BuildConfig.cs'
    $config = 'namespace ApplicationComposerDesktop { internal static class BuildConfig { internal const string SourceRoot = @"' + $projectRoot.Replace('"','""') + '"; internal const string BundleId = "' + $bundleId + '"; } }'
    [System.IO.File]::WriteAllText($configPath,$config,(New-Object System.Text.UTF8Encoding($false)))
    $core = Join-Path $sdk 'lib/net462/Microsoft.Web.WebView2.Core.dll'; $forms = Join-Path $sdk 'lib/net462/Microsoft.Web.WebView2.WinForms.dll'
    $exe = Join-Path $buildRoot 'Application Composer.exe'
    & $compiler /nologo /target:winexe /optimize+ /platform:x64 "/out:$exe" "/win32icon:$(Join-Path $PSScriptRoot 'assets/application-composer.ico')" "/win32manifest:$(Join-Path $PSScriptRoot 'app.manifest')" /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Web.Extensions.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll "/r:$core" "/r:$forms" "/resource:$archive,Composer.AppBundle" "/resource:$core,Microsoft.Web.WebView2.Core" "/resource:$forms,Microsoft.Web.WebView2.WinForms" (Join-Path $PSScriptRoot 'Runtime.cs') (Join-Path $PSScriptRoot 'Bundle.cs') (Join-Path $PSScriptRoot 'Main.cs') $configPath
    if ($LASTEXITCODE -ne 0) { throw 'Desktop executable compilation failed.' }
    if ($InstallDesktop) {
        $desktopPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Application Composer.exe'
        Copy-Item -LiteralPath $exe -Destination $desktopPath -Force
        Write-Output "Installed standalone desktop application: $desktopPath"
    }
    Write-Output "Built standalone executable: $exe"
    Write-Output ('Executable size: ' + [math]::Round((Get-Item -LiteralPath $exe).Length/1MB,1) + ' MB')
} finally { if ($ownsLock) { $buildLock.ReleaseMutex() }; $buildLock.Dispose() }

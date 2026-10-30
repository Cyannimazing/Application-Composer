param()
$ErrorActionPreference = 'Stop'
$version = '1.0.4314.35'
$sdk = Join-Path (Split-Path -Parent $PSScriptRoot) ('.local/desktop-sdk/webview2-' + $version)
if (-not (Test-Path -LiteralPath (Join-Path $sdk 'lib/net462/Microsoft.Web.WebView2.Core.dll'))) {
    New-Item -ItemType Directory -Path $sdk -Force | Out-Null
    $archive = Join-Path $sdk 'sdk.nupkg'
    Invoke-WebRequest -Uri ('https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/' + $version + '/microsoft.web.webview2.' + $version + '.nupkg') -OutFile $archive -UseBasicParsing
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($archive,$sdk)
}
Write-Output $sdk

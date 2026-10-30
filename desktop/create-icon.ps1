param([string]$OutputPath = (Join-Path $PSScriptRoot 'assets/application-composer.ico'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Path (Split-Path -Parent $OutputPath) -Force | Out-Null
$sizes = @(16,24,32,48,64,128,256)
$images = @()
foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap($size,$size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pad = [single]($size * 0.035); $diameter = [single]($size * 0.28); $edge = [single]($size - $pad * 2)
    $path.AddArc($pad,$pad,$diameter,$diameter,180,90)
    $path.AddArc(($pad+$edge-$diameter),$pad,$diameter,$diameter,270,90)
    $path.AddArc(($pad+$edge-$diameter),($pad+$edge-$diameter),$diameter,$diameter,0,90)
    $path.AddArc($pad,($pad+$edge-$diameter),$diameter,$diameter,90,90); $path.CloseFigure()
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(31,36,44))
    $graphics.FillPath($brush,$path)
    $font = New-Object System.Drawing.Font('Segoe UI',([single]($size * 0.40)),[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center; $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0,([single](-$size * 0.015)),([single]$size),([single]$size))
    $graphics.DrawString('AC',$font,[System.Drawing.Brushes]::White,$rect,$format)
    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream,[System.Drawing.Imaging.ImageFormat]::Png)
    $images += ,$stream.ToArray()
    $stream.Dispose(); $format.Dispose(); $font.Dispose(); $brush.Dispose(); $path.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
$output = [System.IO.File]::Create($OutputPath)
$writer = New-Object System.IO.BinaryWriter($output)
try {
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    for ($i=0; $i -lt $sizes.Count; $i++) {
        $dimension = if ($sizes[$i] -eq 256) { 0 } else { $sizes[$i] }
        $writer.Write([byte]$dimension); $writer.Write([byte]$dimension); $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$images[$i].Length); $writer.Write([uint32]$offset)
        $offset += $images[$i].Length
    }
    foreach ($image in $images) { $writer.Write([byte[]]$image) }
} finally { $writer.Dispose(); $output.Dispose() }
Write-Output "Created multi-resolution icon: $OutputPath"

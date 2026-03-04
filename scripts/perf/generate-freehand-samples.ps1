param(
  [string]$OutputDir = "artifacts/perf/samples"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function New-SampleImage {
  param(
    [string]$Path,
    [int]$Width,
    [int]$Height
  )

  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::FromArgb(245, 246, 248))

  $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(34, 34, 34))
  $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(80, 86, 98))
  $linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(205, 210, 219), 2)
  $accentPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(73, 132, 255), 6)

  $fontTitle = New-Object System.Drawing.Font("Segoe UI", 42, [System.Drawing.FontStyle]::Bold)
  $fontBody = New-Object System.Drawing.Font("Segoe UI", 24, [System.Drawing.FontStyle]::Regular)

  for ($x = 0; $x -lt $Width; $x += 96) {
    $graphics.DrawLine($linePen, $x, 0, $x, $Height)
  }
  for ($y = 0; $y -lt $Height; $y += 96) {
    $graphics.DrawLine($linePen, 0, $y, $Width, $y)
  }

  $graphics.DrawString("Freehand Perf Sample", $fontTitle, $titleBrush, 80, 60)
  $graphics.DrawString("${Width}x${Height}", $fontBody, $subBrush, 86, 138)
  $graphics.DrawEllipse($accentPen, [int]($Width * 0.12), [int]($Height * 0.28), [int]($Width * 0.22), [int]($Height * 0.34))
  $graphics.DrawRectangle($accentPen, [int]($Width * 0.48), [int]($Height * 0.26), [int]($Width * 0.28), [int]($Height * 0.36))
  $graphics.DrawLine($accentPen, [int]($Width * 0.08), [int]($Height * 0.88), [int]($Width * 0.92), [int]($Height * 0.88))

  $dir = Split-Path -Path $Path -Parent
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

  $fontTitle.Dispose()
  $fontBody.Dispose()
  $titleBrush.Dispose()
  $subBrush.Dispose()
  $linePen.Dispose()
  $accentPen.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-SampleImage -Path (Join-Path $OutputDir "freehand-4mp.png") -Width 2304 -Height 1728
New-SampleImage -Path (Join-Path $OutputDir "freehand-8mp.png") -Width 3264 -Height 2448

Write-Output "Generated: $OutputDir/freehand-4mp.png"
Write-Output "Generated: $OutputDir/freehand-8mp.png"

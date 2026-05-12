[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$MetaPath = ".screenshots/Capture.tiles.json",

  [Parameter(Mandatory = $false)]
  [string]$OutputPath,

  [Parameter(Mandatory = $false)]
  [switch]$SplitSections,

  [Parameter(Mandatory = $false)]
  [string]$SectionsOutDir
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath {
  param([Parameter(Mandatory = $true)][string]$PathValue)
  return [System.IO.Path]::GetFullPath([System.IO.Path]::Combine((Get-Location).Path, $PathValue))
}

$metaFullPath = Resolve-FullPath -PathValue $MetaPath
if (-not (Test-Path -LiteralPath $metaFullPath)) {
  throw "Meta file not found: $metaFullPath"
}

$metaDir = Split-Path -Path $metaFullPath -Parent
$metaBase = [System.IO.Path]::GetFileNameWithoutExtension($metaFullPath)
if ($metaBase.EndsWith(".tiles")) {
  $metaBase = $metaBase.Substring(0, $metaBase.Length - ".tiles".Length)
}

if (-not $OutputPath) {
  $OutputPath = Join-Path $metaDir "$metaBase-stitched.png"
}
$outputFullPath = Resolve-FullPath -PathValue $OutputPath

if (-not $SectionsOutDir) {
  $SectionsOutDir = Join-Path $metaDir ("$metaBase" + "_sections")
}
$sectionsOutDirFull = Resolve-FullPath -PathValue $SectionsOutDir

$meta = Get-Content -LiteralPath $metaFullPath -Raw | ConvertFrom-Json
if (-not $meta.tiles -or $meta.tiles.Count -lt 1) {
  throw "No tiles found in meta: $metaFullPath"
}

$docHeightCss =
  if ($meta.page -and $meta.page.docHeightCss) { [double]$meta.page.docHeightCss }
  elseif ($meta.docHeightCss) { [double]$meta.docHeightCss }
  else { 0.0 }
if ($docHeightCss -le 0) {
  throw "Invalid doc height in meta (expected page.docHeightCss or docHeightCss): $metaFullPath"
}

$dpr =
  if ($meta.viewport -and $meta.viewport.deviceScaleFactor) { [double]$meta.viewport.deviceScaleFactor }
  elseif ($meta.dpr) { [double]$meta.dpr }
  else { 0.0 }
if ($dpr -le 0) {
  throw "Invalid device scale factor in meta (expected viewport.deviceScaleFactor or dpr): $metaFullPath"
}

function Get-TilePath {
  param([Parameter(Mandatory = $true)]$TileObj)
  $p = $null
  if ($TileObj.filePath) {
    $p = [string]$TileObj.filePath
  } elseif ($TileObj.file) {
    $p = [string]$TileObj.file
  } elseif ($TileObj.fileName -and $meta.tileDir) {
    $p = Join-Path ([string]$meta.tileDir) ([string]$TileObj.fileName)
  }
  if (-not $p) {
    throw "Tile entry has no file path (expected filePath or file)."
  }
  if (-not [System.IO.Path]::IsPathRooted($p)) {
    $p = Join-Path $metaDir $p
  }
  return $p
}

Add-Type -AssemblyName System.Drawing

$firstTile = $meta.tiles[0]
$firstTilePath = Get-TilePath -TileObj $firstTile
if (-not (Test-Path -LiteralPath $firstTilePath)) {
  throw "First tile not found: $firstTilePath"
}

$probe = [System.Drawing.Image]::FromFile($firstTilePath)
$tileWidthPx = $probe.Width
$tileHeightPx = $probe.Height
$probe.Dispose()

$outWidthPx = [int]$tileWidthPx
$outHeightPx = [int][Math]::Round($docHeightCss * $dpr)

$outDir = Split-Path -Path $outputFullPath -Parent
if (-not (Test-Path -LiteralPath $outDir)) {
  New-Item -ItemType Directory -Path $outDir | Out-Null
}

$canvas = New-Object System.Drawing.Bitmap($outWidthPx, $outHeightPx)
$g = [System.Drawing.Graphics]::FromImage($canvas)
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.Clear([System.Drawing.Color]::White)

foreach ($tile in $meta.tiles) {
  $tilePath = Get-TilePath -TileObj $tile
  if (-not (Test-Path -LiteralPath $tilePath)) {
    throw "Tile not found: $tilePath"
  }

  $img = [System.Drawing.Image]::FromFile($tilePath)
  $dy = [int][Math]::Round(([double]$tile.scrollYCss) * $dpr)
  $g.DrawImage($img, 0, $dy, $img.Width, $img.Height)
  $img.Dispose()
}

$canvas.Save($outputFullPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$canvas.Dispose()

Write-Host "Stitched image created: $outputFullPath"

if ($SplitSections) {
  if (-not $meta.sections -or $meta.sections.Count -lt 1) {
    throw "SplitSections requested, but no 'sections' found in meta."
  }

  if (-not (Test-Path -LiteralPath $sectionsOutDirFull)) {
    New-Item -ItemType Directory -Path $sectionsOutDirFull | Out-Null
  }

  $stitched = [System.Drawing.Bitmap]::new($outputFullPath)
  $imgW = $stitched.Width
  $imgH = $stitched.Height
  $scaleY = [double]$imgH / $docHeightCss

  $sections = @($meta.sections)
  for ($i = 0; $i -lt $sections.Count; $i++) {
    $current = $sections[$i]
    $startCss = [double]$current.topCss
    if ($i -lt $sections.Count - 1) {
      $endCss = [double]$sections[$i + 1].topCss
    } else {
      $endCss = $docHeightCss
    }

    $y = [int][Math]::Round($startCss * $scaleY)
    $y2 = [int][Math]::Round($endCss * $scaleY)
    if ($y -lt 0) { $y = 0 }
    if ($y2 -gt $imgH) { $y2 = $imgH }

    $h = $y2 - $y
    if ($h -le 0) { continue }

    $rect = New-Object System.Drawing.Rectangle(0, $y, $imgW, $h)
    $piece = $stitched.Clone($rect, $stitched.PixelFormat)

    $order = ($i + 1).ToString("00")
    $id = [string]$current.id
    $file = Join-Path $sectionsOutDirFull ("$metaBase-$order-$id.png")
    $piece.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
    $piece.Dispose()
  }

  $stitched.Dispose()
  Write-Host "Section images created: $sectionsOutDirFull"
}

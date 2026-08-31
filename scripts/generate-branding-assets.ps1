# Generates app/store branding assets from the approved icon_gpt master.
# Does not modify the original master file.

param(
	[string]$MasterPath = "$PSScriptRoot\..\assets\icon_gpt.png",
	[string]$ImagesDir = "$PSScriptRoot\..\assets\images",
	[string]$ReleaseDir = "$PSScriptRoot\..\release-artifacts"
)

Add-Type -AssemblyName System.Drawing

function New-BitmapCanvas([int]$Size) {
	return New-Object System.Drawing.Bitmap $Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
}

function Draw-HighQualityImage {
	param(
		[System.Drawing.Graphics]$Graphics,
		[System.Drawing.Image]$Image,
		[int]$X,
		[int]$Y,
		[int]$Width,
		[int]$Height
	)
	$Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
	$Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
	$Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
	$Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
	$Graphics.DrawImage($Image, $X, $Y, $Width, $Height)
}

function Save-Png([System.Drawing.Image]$Image, [string]$Path) {
	$dir = Split-Path $Path -Parent
	if ($dir -and -not (Test-Path $dir)) {
		New-Item -ItemType Directory -Force -Path $dir | Out-Null
	}
	$Image.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Get-AverageCornerColor([System.Drawing.Bitmap]$Bitmap) {
	$points = @(
		(0, 0),
		($Bitmap.Width - 1, 0),
		(0, $Bitmap.Height - 1),
		($Bitmap.Width - 1, $Bitmap.Height - 1)
	)
	$r = 0; $g = 0; $b = 0
	foreach ($p in $points) {
		$c = $Bitmap.GetPixel($p[0], $p[1])
		$r += $c.R; $g += $c.G; $b += $c.B
	}
	return [System.Drawing.Color]::FromArgb(255, [int]($r / 4), [int]($g / 4), [int]($b / 4))
}

function New-SolidBackground([int]$Size, [System.Drawing.Color]$Color) {
	$bmp = New-BitmapCanvas $Size
	$g = [System.Drawing.Graphics]::FromImage($bmp)
	$g.Clear($Color)
	$g.Dispose()
	return $bmp
}

function New-MonochromeFromMaster([System.Drawing.Bitmap]$Master, [System.Drawing.Color]$BackgroundColor) {
	$size = 1024
	$bmp = New-BitmapCanvas $size
	$g = [System.Drawing.Graphics]::FromImage($bmp)
	$g.Clear([System.Drawing.Color]::Transparent)

	# Scale master into adaptive safe zone (~72%) so silhouette survives masks.
	$drawSize = [int]($size * 0.72)
	$offset = [int](($size - $drawSize) / 2)
	Draw-HighQualityImage -Graphics $g -Image $Master -X $offset -Y $offset -Width $drawSize -Height $drawSize

	for ($y = 0; $y -lt $size; $y++) {
		for ($x = 0; $x -lt $size; $x++) {
			$pixel = $bmp.GetPixel($x, $y)
			if ($pixel.A -lt 16) { continue }

			$bgDistance = [Math]::Abs($pixel.R - $BackgroundColor.R) +
				[Math]::Abs($pixel.G - $BackgroundColor.G) +
				[Math]::Abs($pixel.B - $BackgroundColor.B)

			if ($bgDistance -lt 42) {
				$bmp.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
				continue
			}

			$gray = [int](($pixel.R + $pixel.G + $pixel.B) / 3)
			if ($gray -gt 210) {
				$bmp.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
				continue
			}

			$bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 45, 90, 61))
		}
	}

	$g.Dispose()
	return $bmp
}

if (-not (Test-Path $MasterPath)) {
	throw "Master icon not found: $MasterPath"
}

$master = [System.Drawing.Bitmap]::FromFile($MasterPath)
Write-Output "Master: $MasterPath ($($master.Width)x$($master.Height))"

$backgroundColor = Get-AverageCornerColor $master
Write-Output "Adaptive background color: #$($backgroundColor.R.ToString('X2'))$($backgroundColor.G.ToString('X2'))$($backgroundColor.B.ToString('X2'))"

New-Item -ItemType Directory -Force -Path $ImagesDir | Out-Null
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null

# Standard icon — 1024×1024 from master (square, no stretch).
$iconSize = 1024
$iconBmp = New-BitmapCanvas $iconSize
$iconGraphics = [System.Drawing.Graphics]::FromImage($iconBmp)
Draw-HighQualityImage -Graphics $iconGraphics -Image $master -X 0 -Y 0 -Width $iconSize -Height $iconSize
$iconGraphics.Dispose()
Save-Png $iconBmp "$ImagesDir\icon.png"
$iconBmp.Dispose()

# RuStore storefront icon — exact 512×512.
$storeBmp = New-BitmapCanvas 512
$storeGraphics = [System.Drawing.Graphics]::FromImage($storeBmp)
Draw-HighQualityImage -Graphics $storeGraphics -Image $master -X 0 -Y 0 -Width 512 -Height 512
$storeGraphics.Dispose()
Save-Png $storeBmp "$ReleaseDir\rustore-icon-512.png"
$storeBmp.Dispose()

# Adaptive background — solid cream from master corners.
$adaptiveBg = New-SolidBackground 1024 $backgroundColor
Save-Png $adaptiveBg "$ImagesDir\android-icon-background.png"
$adaptiveBg.Dispose()

# Adaptive foreground — same artwork inset into Android safe zone (~72%).
$foregroundSize = 1024
$foregroundDraw = [int]($foregroundSize * 0.72)
$foregroundOffset = [int](($foregroundSize - $foregroundDraw) / 2)
$foregroundBmp = New-BitmapCanvas $foregroundSize
$foregroundGraphics = [System.Drawing.Graphics]::FromImage($foregroundBmp)
$foregroundGraphics.Clear([System.Drawing.Color]::Transparent)
Draw-HighQualityImage -Graphics $foregroundGraphics -Image $master -X $foregroundOffset -Y $foregroundOffset -Width $foregroundDraw -Height $foregroundDraw
$foregroundGraphics.Dispose()
Save-Png $foregroundBmp "$ImagesDir\android-icon-foreground.png"
$foregroundBmp.Dispose()

# Monochrome — house + garden silhouette derived from master.
$monoBmp = New-MonochromeFromMaster $master $backgroundColor
Save-Png $monoBmp "$ImagesDir\android-icon-monochrome.png"
$monoBmp.Dispose()

# Splash — centered master on transparent canvas; splash background set in app.json.
$splashSize = 1024
$splashDraw = [int]($splashSize * 0.62)
$splashOffset = [int](($splashSize - $splashDraw) / 2)
$splashBmp = New-BitmapCanvas $splashSize
$splashGraphics = [System.Drawing.Graphics]::FromImage($splashBmp)
$splashGraphics.Clear([System.Drawing.Color]::Transparent)
Draw-HighQualityImage -Graphics $splashGraphics -Image $master -X $splashOffset -Y $splashOffset -Width $splashDraw -Height $splashDraw
$splashGraphics.Dispose()
Save-Png $splashBmp "$ImagesDir\splash-icon.png"
$splashBmp.Dispose()

# Favicon for web metadata.
$faviconBmp = New-BitmapCanvas 48
$faviconGraphics = [System.Drawing.Graphics]::FromImage($faviconBmp)
Draw-HighQualityImage -Graphics $faviconGraphics -Image $master -X 0 -Y 0 -Width 48 -Height 48
$faviconGraphics.Dispose()
Save-Png $faviconBmp "$ImagesDir\favicon.png"
$faviconBmp.Dispose()

$master.Dispose()
Write-Output "Branding assets generated in $ImagesDir and $ReleaseDir"

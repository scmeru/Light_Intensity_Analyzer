Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\Logo_UnivLampung.png"
$pngDst = Join-Path $PSScriptRoot "..\public\icon.png"
$icoDst = Join-Path $PSScriptRoot "..\public\icon.ico"

$source = [System.Drawing.Image]::FromFile((Resolve-Path $srcPath))

# 1. Generate high-res 512x512 PNG
$target512 = New-Object System.Drawing.Bitmap(512, 512)
$g512 = [System.Drawing.Graphics]::FromImage($target512)
$g512.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g512.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g512.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g512.Clear([System.Drawing.Color]::Transparent)
$pad = 16
$g512.DrawImage($source, $pad, $pad, 512 - ($pad * 2), 512 - ($pad * 2))
$target512.Save((Resolve-Path $pngDst), [System.Drawing.Imaging.ImageFormat]::Png)
$g512.Dispose()

# 2. Generate multi-resolution ICO file (256, 128, 64, 48, 32, 16)
$sizes = @(256, 128, 64, 48, 32, 16)
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)

# ICO Header
$bw.Write([uint16]0) # Reserved
$bw.Write([uint16]1) # Type 1 = ICO
$bw.Write([uint16]$sizes.Count) # Number of images

$imageDataList = @()
$offset = 6 + ($sizes.Count * 16)

foreach ($sz in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    
    $p = [int]($sz * 0.04)
    $g.DrawImage($source, $p, $p, $sz - ($p * 2), $sz - ($p * 2))
    
    $imgStream = New-Object System.IO.MemoryStream
    $bmp.Save($imgStream, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $imgStream.ToArray()
    $imageDataList += ,$bytes
    
    # Directory entry
    $bw.Write([byte]($sz % 256)) # Width (0 means 256)
    $bw.Write([byte]($sz % 256)) # Height
    $bw.Write([byte]0)           # Color palette
    $bw.Write([byte]0)           # Reserved
    $bw.Write([uint16]1)         # Color planes
    $bw.Write([uint16]32)        # Bits per pixel
    $bw.Write([uint32]$bytes.Length) # Image size
    $bw.Write([uint32]$offset)       # Image offset
    
    $offset += $bytes.Length
    
    $g.Dispose()
    $bmp.Dispose()
    $imgStream.Dispose()
}

# Write image data
foreach ($bytes in $imageDataList) {
    $bw.Write($bytes)
}

[System.IO.File]::WriteAllBytes([System.IO.Path]::GetFullPath($icoDst), $ms.ToArray())
$bw.Dispose()
$ms.Dispose()
$target512.Dispose()
$source.Dispose()

Write-Host "Generated icon.png and icon.ico successfully!"

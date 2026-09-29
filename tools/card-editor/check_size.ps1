Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile((Resolve-Path 'C:\Users\maekawa\Documents\カードジェネレーター\新カードフレーム画像\赤返還値1二つ名なし.png'))
Write-Host "Width: $($img.Width), Height: $($img.Height)"
$img.Dispose()
